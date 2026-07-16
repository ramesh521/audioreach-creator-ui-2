# Graph Designer Edit — Core Edit Session Design

Requirements: [../requirements/graph-designer-edit-requirements.md](../requirements/graph-designer-edit-requirements.md)
(REQ-001, 001a, 002, 002a, 003, 044–046, 060–062, 065; REQ-066/067 explicitly out of scope — see below)

This document covers the foundation everything else in the Graph Designer
Edit feature builds on: the View/Edit mode switch, the exclusive lock that
keeps Edit mode from conflicting with the Discovery Wizard or Diff/Merge
view, and the Apply Changes / Discard lifecycle. The four other design docs
(node operations, link/port operations, KV/key configuration, canvas UI
mechanics) all assume this session exists and call into it.

## Table of Contents

- [Out of Scope](#out-of-scope)
- [Architecture](#architecture)
- [Mode State & Exclusive Locking](#mode-state--exclusive-locking)
- [Per-Operation Loading State](#per-operation-loading-state)
- [Response Reconciliation — Component Collections](#response-reconciliation--component-collections)
- [Apply Changes](#apply-changes)
- [Discard / Rollback](#discard--rollback)
- [Open Items Inherited](#open-items-inherited)

---

## Out of Scope

**REQ-066/067 (undo/redo).** REQ-066 (backend returns a `changeId` per
staged edit) is already satisfied at the data layer — every DTO already
carries `ChangeInfoDto.changeId` — and needs no frontend work here. REQ-067
(a `changeId` stack + undo/redo panel) is deferred to a future enhancement;
nothing in this document depends on it existing.

**REQ-068 (quick actions).** Deferred alongside REQ-067; context menus
(designed in `canvas-ui-mechanics-design.md`) are the only interaction
surface for node/edge actions in this pass.

---

## Architecture

Edit-session state is a new `EditSessionSlice`, composed into the existing
`GraphDesignerStore` (`packages/react-app/src/features/graph-designer/model/graph-designer-store.ts`)
the same way `GraphDataSlice`, `KeyConfigSlice`, `VisualizerSlice`, etc. are
composed today:

```typescript
export type GraphDesignerStore = UsecaseSelectionSlice &
  GraphDataSlice &
  VisualizerSlice &
  SubsystemSlice &
  KeyConfigSlice &
  ValidationResultSlice &
  ModuleListSlice &
  SubgraphListSlice &
  PropertiesViewSlice &
  PanelLayoutSlice &
  PanelTabRegistrySlice &
  SearchSlice &
  EditSessionSlice; // new
```

**No optimistic mutation.** Every structural edit designed across all five
documents follows one rule: call the backend first, merge the response into
`GraphDataSlice` only on success, toast and leave the canvas untouched on
failure. `EditSessionSlice` itself holds no graph data — it holds session
bookkeeping (mode, in-flight flags, the modification summary, the discard
confirmation gate) that other slices' actions read and write as a
side-effect of their own backend calls.

This was chosen over two alternatives considered during design:

- **Command-pattern undo buffer** — rejected as unnecessary weight now that
  undo/redo is deferred; REQ-067's own language (`changeId` stack) points at
  a server-driven restore, not a client-side command replay.
- **Fully separate sibling store** (parallel to the planned `DiffMergeStore`)
  — rejected because `GraphDataSlice` must mutate in place either way once
  the backend confirms an edit; a separate store would only add cross-store
  sync plumbing for no isolation benefit.

---

## Mode State & Exclusive Locking

**REQ-001–003.** The canvas has two modes, `'view'` and `'edit'`. In `view`,
structural editing surfaces — module/subgraph palettes, context-menu
structural actions, and the Key Configurator panel — do not render
(REQ-002). Two interactions remain available in `view` regardless of mode:
the existing double-click-to-tune flow (REQ-002, unchanged), and clicking a
module/subgraph/container/data-or-control-link, which opens the **same**
properties panel used in Edit mode but in a **read-only** state (REQ-002a)
— every field rendered, none editable, no port-count steppers, no rename
input. This is a `readOnly` prop threaded into the existing panel widget
(`widgets/properties-panel/`, same component REQ-051 designs the editable
fields for in `canvas-ui-mechanics-design.md`), driven by
`mode === 'view'`; it is not a second panel implementation. Content menus,
palettes, and the Key Configurator panel are unaffected by REQ-002a — only
the properties panel gains a read-only mode.

**REQ-001a — View-mode canvas selection.** On entering View mode (including
on initial load), the canvas renders the last-selected use cases from
`UsecaseSelectionSlice`. If no prior selection exists for this project (for
example, first open), it falls back to the first use case in the list
returned by the use-case list load. This is a read at mount/mode-transition
time, not new state — `UsecaseSelectionSlice` already persists the last
selection. The Graph Visualizer and Log View panels render alongside the
canvas in View mode exactly as they do today; this feature does not change
their visibility.

In `edit`, the module/subgraph palettes, context
menus, properties panel (now editable), and Key Configurator panel all
become active (designed across the other four docs).

```typescript
interface EditSessionSlice {
  mode: 'view' | 'edit';
  enterEditMode: () => boolean; // false if the exclusive lock is already held elsewhere
  exitEditMode: () => void;     // called internally after Apply success or Discard
  // ... Apply/Discard state, below
}
```

**REQ-060, 062 — exclusive-mode locking.** The Discovery Wizard and
Diff/Merge view are separate features (Diff/Merge doesn't exist in code yet;
Discovery Wizard is currently a stub) that can independently modify graph
structure, so at most one of {Graph Edit, Discovery Wizard, Diff/Merge} may
be active at a time **for a given project**. Because FSD forbids one
feature from importing another directly, the lock lives one layer down, in
the existing cross-cutting `shared/store/global-store.ts`.

**The lock must be keyed by `projectId`, not a single flat flag.** This
repo supports multiple simultaneously open projects
(`ProjectGroupSlice.openProjects`, a `maxOpenProjects` preference, and
per-project `projectStoreRegistry`/`tabStoreRegistry` instances), and each
Graph Designer edit session is itself per-project
(`createGraphDesignerStore(tabId, projectId)`). REQ-060/062 only require
blocking conflicts *within the same project's* graph — entering Edit mode
on Project A must not disable "Start Graph Modification" or block Discovery
Wizard/Diff-Merge on an unrelated Project B that happens to also be open. A
single app-global flag would produce exactly that cross-project blocking
bug, so the lock is a per-project map:

```typescript
type ExclusiveGraphMode = 'none' | 'graph-edit' | 'discovery-wizard' | 'diff-merge';

interface GlobalStore {
  // ...existing slices...
  activeExclusiveModeByProject: Record<string, ExclusiveGraphMode>;
  /** Returns false if a different mode already holds the lock for this project. */
  setActiveExclusiveMode: (projectId: string, mode: ExclusiveGraphMode) => boolean;
  /** Only clears the lock if `mode` is the value currently held for this
   *  project — guards against a stale unmount releasing a lock a newer
   *  instance acquired. */
  releaseExclusiveMode: (projectId: string, mode: ExclusiveGraphMode) => void;
}
```

`enterEditMode()` calls `setActiveExclusiveMode(projectId, 'graph-edit')`;
if it returns `false`, edit mode does not start. This is surfaced as a
disabled "Start Graph Modification" button with an explanatory tooltip
(REQ-062), not a runtime error — the button's `disabled` state is a plain
selector read, scoped to the tab's own `projectId`:

```typescript
const activeExclusiveMode = useGlobalStore(
  (s) => s.activeExclusiveModeByProject[projectId] ?? 'none',
);
const disabled = activeExclusiveMode !== 'none' && activeExclusiveMode !== 'graph-edit';
```

Because this is a Zustand selector, any component reading it re-renders the
instant that project's lock changes — no events or polling needed.

**Discovery Wizard has no mount lifecycle to hook into today.** As of this
writing, Discovery Wizard is only a `sideNavItems` menu entry (id
`'discovery-wizard'` in `widgets/graph-designer/ui/graph-designer.tsx`) with
no backing component — clicking it is currently a no-op. Diff/Merge does
not exist in code at all yet. Until either is built as a real mounted
feature, REQ-060's enforcement point for *this* pass is the menu entry
itself: its `onClick`/`disabled` state must read
`activeExclusiveModeByProject[projectId]` the same selector shown above,
and show the explanatory tooltip (REQ-060) whenever a `'graph-edit'` lock is
held for that project, instead of opening anything. When Discovery
Wizard/Diff/Merge are later built as real features with their own mount
lifecycle, they switch to the `useEffect` acquire/release pattern below
instead of the menu-level disable — this is a placeholder enforcement point,
not a permanent design choice.

Discovery Wizard and Diff/Merge (built separately, out of scope here)
acquire and release the same per-project flag from their own mount
lifecycle, using whichever `projectId` their own tab is scoped to:

```typescript
useEffect(() => {
  const acquired = setActiveExclusiveMode(projectId, 'diff-merge');
  if (!acquired) {
    // show "already in use by Graph Modification" and bail
  }
  return () => releaseExclusiveMode(projectId, 'diff-merge');
}, [projectId]);
```

**Lock is tied to component lifetime, not tab focus.** This repo's
FlexLayout-based tab system (`widgets/project-layout/project-layout-manager.tsx`)
keeps inactive tabs mounted — hidden via CSS `display: none` — and only
unmounts a tab's component tree on explicit tab close
(`enableRenderOnDemand`'s default portal-based rendering; confirmed no
per-switch factory re-invocation exists in this codebase). Consequently:

- Switching focus away from an open Diff/Merge tab **does not** release the
  lock — "Start Graph Modification" stays disabled, because the Diff/Merge
  session is still alive in the background and could still be resumed.
- Closing the Diff/Merge tab unmounts it, the `useEffect` cleanup fires,
  the lock releases, and "Start Graph Modification" enables immediately
  (reactive, no polling).

This is a deliberate choice, not an artifact of the mechanism: REQ-060's
concern is that Diff/Merge "can modify the graph structure independently,"
and that risk exists for as long as the session is alive, not only while its
tab happens to be focused.

```mermaid
sequenceDiagram
  participant U as User
  participant DM as Diff/Merge (mount lifecycle)
  participant G as global-store
  participant GD as Graph Designer

  DM->>G: setActiveExclusiveMode(projectId, 'diff-merge')
  G-->>DM: true (acquired)
  Note over GD: "Start Graph Modification" reads activeExclusiveModeByProject[projectId] → disabled
  U->>GD: switches tab focus to Graph Designer (Diff/Merge stays mounted, hidden)
  Note over GD: still disabled — lock unchanged
  U->>DM: closes Diff/Merge tab
  DM->>DM: unmount → useEffect cleanup fires
  DM->>G: releaseExclusiveMode(projectId, 'diff-merge')
  G-->>GD: activeExclusiveModeByProject[projectId] → 'none' (selector re-render)
  Note over GD: "Start Graph Modification" now enabled
```

---

## Per-Operation Loading State

**REQ-065.** Every operation across all five design docs that requires a
backend call — module/container/subgraph/subsystem add/delete/rename, link
create/delete, port count changes, CKV/TKV edits, and so on — must show a
loading indicator and make the canvas non-interactive until the response
arrives.

**Design: a single `isMutating: boolean` on `EditSessionSlice`, gating all
canvas interaction for the duration of any one backend call.** Edits are
strictly serial — only one mutating operation may be in flight at a time
for a given edit session. This was chosen over a per-entity
`pendingEntityIds` set (considered and rejected during design) because a
per-entity set cannot, by construction, block interaction with entities
*not yet known to be affected* — for example, deleting module M cascades to
delete every link connected to M, but the client doesn't know which link
IDs those are until the backend responds; in the meantime nothing stops the
user from independently deleting one of those same links, racing the
in-flight cascade. Serializing all edits behind one flag removes this class
of race entirely: no second mutating call can start while one is
outstanding, so there is no window in which a not-yet-cascaded entity is
still interactive. The cost is that unrelated edits (e.g. renaming module A
while deleting module B) no longer run concurrently — accepted as the
simpler, race-free tradeoff.

```typescript
interface EditSessionSlice {
  // ...
  isMutating: boolean;
  beginMutation: () => void;
  endMutation: () => void;
}
```

Every mutating action designed in `node-operations-design.md`,
`link-and-port-design.md`, and `kv-key-configuration-design.md` follows the
same three-step wrapper, regardless of which entity type it targets:

```typescript
async function withMutationLock<T>(action: () => Promise<T>): Promise<T> {
  if (get().mode !== 'edit') {
    throw new Error('withMutationLock called outside Edit mode'); // programming error, not a user-facing failure — see below
  }
  get().beginMutation();
  try {
    return await action();
  } finally {
    get().endMutation();
  }
}
```

**`withMutationLock` is the single enforcement point for "no mutations
outside Edit mode," not the render layer alone.** REQ-002/003 already keep
palettes, context-menu structural actions, and the Key Configurator panel
from *rendering* in View mode — that's the first line of defense, and
it's why a user should never see a Delete option or a working palette
item while in View mode. But REQ-063 explicitly allows multi-select in
**both** View and Edit mode, and the Delete key is a global `keydown`
listener, not a rendered menu item — nothing about "the context menu
doesn't render" stops a keydown handler from firing on a View-mode
selection. Relying on "not rendered ⇒ not reachable" for every mutating
entry point is fragile: it depends on every future call site remembering
to also gate on `mode`, and a keyboard shortcut in particular has no
render-layer visibility check to piggyback on at all. Routing every
mutating action through `withMutationLock` — the same choke point already
used for the `isMutating` lock — means the guarantee holds regardless of
which UI surface (menu click, keyboard shortcut, a future quick-action
button) attempted the call, with one check instead of one per action.

**This is a thrown error, not a toast or silent no-op, because it signals
a bug in the caller, not a user-facing failure.** Every legitimate call
site for a mutating action is already gated by `mode === 'edit'` at the
UI layer (the surface that could call it doesn't render in View mode), so
`withMutationLock` seeing `mode !== 'edit'` means some code path invoked a
mutation without going through that gating — for example, a stray
keyboard listener that isn't itself checking `mode`. `deleteSelection`
(`canvas-ui-mechanics-design.md`) is the one caller that must check `mode`
*before* calling `withMutationLock`, precisely because the Delete key has
no render-layer gate of its own to rely on:

```typescript
function deleteSelection(selection: Selectable[]): Promise<void> {
  if (get().mode !== 'edit') return Promise.resolve(); // Delete key fires in View mode too (REQ-063) — no-op, not an error, since this is a normal/expected case, not a bug
  if (get().isMutating) return Promise.resolve();
  // ...unchanged below
}
```

Every other mutating action in `node-operations-design.md`/
`link-and-port-design.md`/`kv-key-configuration-design.md` is only ever
invoked from a UI surface that already doesn't render outside Edit mode
(palette drop handlers, context-menu items, the properties panel's
editable fields, the Key Configurator panel) — for those, reaching
`withMutationLock` with the wrong mode really would indicate a bug, so the
thrown error is the right signal there.

**A single full-canvas overlay is the enforcement point, not per-component
`disabled` props.** While `isMutating` is `true`, a canvas-wide overlay
renders: a wait cursor, and an event-capturing layer that blocks all
pointer interaction with palettes, context menus, the properties panel, the
Key Configurator panel, and node/edge selection. The batch Delete-key
handler (`deleteSelection`, `canvas-ui-mechanics-design.md`) checks
`isMutating` at the top and no-ops entirely if true, for the same reason —
the Delete key bypasses whatever DOM-level pointer blocking the overlay
provides, so it needs its own explicit guard rather than relying on the
overlay alone.

```typescript
const isMutating = useGraphDesignerStore((s) => s.isMutating);
// rendered once, above the canvas, not per-node:
{isMutating && <MutationOverlay />} // wait cursor + pointer-event capture
```

This replaces per-entity spinners as the *interaction* gate; a lightweight
spinner on the specific entity the user acted on (module being deleted,
module being renamed, etc.) is still worth keeping as a purely cosmetic
affordance — it does not gate anything on its own, since the overlay above
already blocks all interaction regardless of which entity is showing a
spinner.

**Exception: REQ-025's Escape-to-cancel is not gated.** Canceling an
in-progress connection attempt is purely local `UsecaseVisualizer` state
with no backend call (`link-and-port-design.md`) — it is unaffected by
`isMutating` and remains available even mid-mutation, since it can't race
anything the backend is doing.

For operations that don't yet have a real entity ID (for example REQ-006's
atomic subgraph-from-empty-space creation, before the backend has returned
one), the node still renders at the drop position immediately (REQ-058)
with its own cosmetic spinner active — the overlay's interaction block
already covers it regardless of ID.

---

## Response Reconciliation — Component Collections

**One shared shape and one shared reconciler for every backend response
that adds, updates, or deletes more than a single already-known entity
field.** Across `node-operations-design.md` and `link-and-port-design.md`,
several operations cascade to child entities — module delete, container
delete, subsystem delete, subsystem expand, subsystem move, DSP offload,
paste-a-subgraph — and each one needs the backend's response to enumerate
its full blast radius so the UI can reconcile in one response cycle, as the
requirements repeatedly demand (REQ-005/006/007/008-009/020/031a/031b/032/069-070/072).

**This is the real backend contract, confirmed against the current API
spec — not an invented shape.** Every structural endpoint already in the
API (`queryUsecaseComponents`, `getComponentsForSubgraph`,
`createDataLink`/`createControlLink`) returns the same
`ComponentCollectionDto`, and the load path already consuming it today
(`GraphDataSlice`'s existing `loadGraphData`,
`packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`)
is the model every cascading action in this feature reuses — this section
generalizes that existing pattern into one shared reconciler, rather than
introducing a new one:

```typescript
interface ChangeInfoDto {
  changeType: 'NONE' | 'CREATE' | 'UPDATE' | 'DELETE';
  changeId?: string;   // present only when changeType !== 'NONE'
  changeStatus?: 'STAGED' | 'UNSTAGED'; // present only when changeType !== 'NONE'
}

interface ComponentCollectionDto {
  spfModules: SpfModuleDto[]; // each carries containerId/subgraphId as scalar fields — no separate containers/subgraphs arrays
  dataLinks: DataLinkDto[];
  controlLinks: ControlLinkDto[];
  subsystems?: SubsystemDto[]; // present only on the -with-subsystems endpoint variant, below
}
// SpfModuleDto, DataLinkDto, ControlLinkDto, SubsystemDto each carry their
// own `changeInfo: ChangeInfoDto` — the change type is per-entity, not a
// top-level added/updated/deleted split.
```

**There is no `added`/`updated`/`deleted` bucketing at the collection
level — each entity self-declares its own `changeInfo.changeType`,
module-centric.** Containers and subgraphs are not returned as separate
arrays at all; they're derived by grouping `spfModules` by
`containerId`/`subgraphId`, exactly as `loadGraphData` already does today
(see its `containers`/`subgraphs` derivation loops). The reconciler below
generalizes that same grouping logic so every cascading action shares it,
instead of each action re-deriving containers/subgraphs from its own
response by hand.

**Mutation responses are delta-only — `changeType: 'NONE'` never appears
outside read-only query responses.** A create/delete/expand/move/offload
response's `spfModules`/`dataLinks`/`controlLinks` arrays contain only
entities that actually changed (`CREATE`/`UPDATE`/`DELETE`); the reconciler
never has to skip a `NONE`-tagged entity out of a mutation response. `NONE`
only shows up on the read-only query endpoints
(`queryUsecaseComponents`/`getComponentsForSubgraph`), where it means
"unchanged, included for context" — those endpoints' full-snapshot
responses go through `loadGraphData`'s existing replace-everything logic,
not this incremental reconciler.

```typescript
function applyComponentCollection(collection: ComponentCollectionDto): void {
  set((state) => {
    for (const m of collection.spfModules) upsertOrDeleteModule(state, m);
    for (const l of collection.dataLinks) upsertOrDeleteLink(state, l, 'data');
    for (const l of collection.controlLinks) upsertOrDeleteLink(state, l, 'control');
    for (const ss of collection.subsystems ?? []) upsertOrDeleteSubsystem(state, ss);
    recomputeContainersAndSubgraphs(state); // re-derive by grouping state.moduleInstances, same logic loadGraphData already uses
  });
}

function upsertOrDeleteModule(state: GraphDataState, m: SpfModuleDto): void {
  if (m.changeInfo.changeType === 'DELETE') {
    delete state.graphData.moduleInstances[m.systemId];
    return;
  }
  state.graphData.moduleInstances[m.systemId] = toModuleInstance(m); // same mapping loadGraphData already does
}
```

**Containers/subgraphs are never deleted directly — they disappear when
their last module does.** Because they're derived, not stored as their own
entities with their own `changeType`, a container/subgraph delete
(REQ-020, REQ-016b/c) is expressed purely through its modules: every
`SpfModuleDto` the container/subgraph contained comes back with
`changeType: 'DELETE'`, and `recomputeContainersAndSubgraphs` (re-run after
every `applyComponentCollection` call, same as `loadGraphData` already
does on full load) simply produces no entry for a container/subgraph ID
that no surviving module references anymore. No separate
`deletedContainerIds`/`deletedSubgraphIds` bucket is needed or returned by
the backend — module-level deletes are sufficient to derive the
container/subgraph-level effect.

**`recomputeContainersAndSubgraphs` also prunes the session-local maps
keyed by subgraph/link ID — this is not automatic just because those maps
live in the same store.** `EditSessionSlice.subgraphProvenanceById` is
*read* by the derivation (to stamp `provenance` onto each subgraph it
produces), but reading isn't pruning: nothing removes an entry once its
subgraph stops being derivable, so a cascade-deleted subgraph (module
delete emptying its last container, container delete, subsystem delete,
etc.) would otherwise leave that entry orphaned in the map forever — a
slow leak, and stale data if a future subgraph ever happened to reuse the
same ID. The fix is one pass over the *freshly-derived* subgraph set,
inside the same function that already computes it, not a separate
per-action cleanup step. `state` below is the whole composed
`GraphDesignerStore` passed to Zustand's `set` callback, not only
`GraphDataSlice`'s own fields — `subgraphProvenanceById` lives on
`EditSessionSlice`, but both slices are fields on the same store object,
so there is no cross-slice boundary to cross at the type level, only a
documentation convention of which slice "owns" which field:

```typescript
function recomputeContainersAndSubgraphs(state: GraphDesignerStore): void {
  const {containers, subgraphs} = deriveFromModules(state.graphData.moduleInstances); // existing grouping logic
  state.graphData.containers = containers;
  state.graphData.subgraphs = subgraphs;

  // Prune subgraphProvenanceById: drop any entry whose subgraph no longer derives.
  for (const subgraphId of state.subgraphProvenanceById.keys()) {
    if (!(subgraphId in subgraphs)) state.subgraphProvenanceById.delete(subgraphId);
  }
}
```

**`pairLinksById`/`excludedLinkIds` are pruned by `applyComponentCollection`
itself, not by the subgraph-derivation pass — the response already names
exactly which links died, no diffing needed.** Every deleted link arrives
in the same `ComponentCollectionDto` as `changeInfo.changeType: 'DELETE'`
(a cascade-deleted subgraph's pair-rendered connections included — the
backend tags them the same way it tags any other severed link), so pruning
these two maps is a direct lookup against the collection's own
`dataLinks`/`controlLinks`, not something that needs the before/after
subgraph-set comparison the provenance map requires:

```typescript
function applyComponentCollection(collection: ComponentCollectionDto): void {
  set((state) => {
    for (const m of collection.spfModules) upsertOrDeleteModule(state, m);
    for (const l of collection.dataLinks) upsertOrDeleteLink(state, l, 'data');
    for (const l of collection.controlLinks) upsertOrDeleteLink(state, l, 'control');
    for (const ss of collection.subsystems ?? []) upsertOrDeleteSubsystem(state, ss);
    recomputeContainersAndSubgraphs(state); // also prunes subgraphProvenanceById, above
    pruneDeletedLinkBookkeeping(state, collection); // pairLinksById/excludedLinkIds
  });
}

function pruneDeletedLinkBookkeeping(state: GraphDesignerStore, collection: ComponentCollectionDto): void {
  const deletedLinkIds = [...collection.dataLinks, ...collection.controlLinks]
    .filter((l) => l.changeInfo.changeType === 'DELETE')
    .map((l) => l.systemId);
  for (const linkId of deletedLinkIds) {
    state.pairLinksById.delete(linkId);
    state.excludedLinkIds = state.excludedLinkIds.filter((id) => id !== linkId);
  }
}
```

**This generalizes to every cascading action in the feature, not just
module delete.** Container delete, subsystem delete, subsystem expand,
and any future cascading endpoint all funnel through this same
`applyComponentCollection` call — so the pruning above runs automatically
regardless of which action triggered the cascade, with no per-action
cleanup logic duplicated across `node-operations-design.md`/
`link-and-port-design.md`.

**Subsystem deletes/promotions ride on `SubsystemDto.changeInfo` directly**,
since subsystems (unlike containers/subgraphs) *are* returned as
first-class entities with their own `changeType` — a subsystem expand
(REQ-032) returns the expanded subsystem with `changeType: 'DELETE'` and
every promoted child module with `changeType: 'UPDATE'` (new
`containerId`/`subgraphId` reflecting the promoted level), which is enough
for the reconciler to remove the subsystem and re-parent its former
contents in one pass — no separate `promotedNodeIds` field needed.

**Endpoint variant (plain vs. `-with-subsystems`) is chosen once per edit
session, not per call.** The API exposes two forms of every mutating
endpoint that can affect subsystem structure — a plain form returning
`ComponentCollectionDto` without `subsystems`, and a `-with-subsystems`
form returning the same shape with `subsystems` populated
(`createDataLinkWithSubsystems`/`createControlLinkWithSubsystems` today;
any future cascading endpoint TBD with the backend team is expected to
offer the same pair). Because the requirements forbid changing the
raw/subsystem display mode mid-edit-session (out of scope per this
document's own [Out of Scope](#out-of-scope) note — the toggle is a
pre-existing, separately-built concern), `EditSessionSlice` decides which
form to call **once, when Edit mode is entered**, and every mutating
action for the rest of that session uses that same choice:

```typescript
interface EditSessionSlice {
  // ...
  usesSubsystemVariant: boolean; // fixed for the lifetime of the edit session, set in enterEditMode()
}
```

`enterEditMode()` reads whatever state the (out-of-scope, assumed-built)
raw/subsystem-mode toggle exposes at that moment and stores the result;
every action in `node-operations-design.md`/`link-and-port-design.md` that
needs to pick between e.g. `createLink`/`createLinkWithSubsystems` reads
`usesSubsystemVariant` rather than re-checking the toggle on every call.
This also means `applyComponentCollection` can assume `subsystems` is
either always present or always absent for a given session — it never has
to handle a session that mixes the two.

**Caller-owned fields are stamped before the collection is applied, not by
the reconciler.** `applyComponentCollection` is intentionally a generic,
dumb per-entity upsert/delete with no knowledge of frontend-only
bookkeeping fields — `provenance` on a `Subgraph` (`node-operations-design.md`)
is the main example, since the backend never returns it and subgraphs
aren't even a first-class entity in the response to attach a field to
directly. Because subgraphs are derived from grouped modules,
`provenance` is tracked in a small session-local map keyed by
`subgraphId`, populated by each call site *before* calling
`applyComponentCollection`, and consulted by `recomputeContainersAndSubgraphs`
when it builds each subgraph entry:

```typescript
interface EditSessionSlice {
  // ...
  subgraphProvenanceById: Map<string, SubgraphProvenance>;
}

async function createModuleWithAutoCreate(moduleDefId: string, position: XY): Promise<void> {
  const module = await api.addSpfModule({moduleSystemId, procSystemId}); // subgraphSystemId/containerSystemId omitted — auto-create
  const [subgraphs] = await api.querySubgraphs([module.subgraphId]); // subgraphType/SGKV — not derivable from the module alone
  await api.queryContainers([module.containerId]); // confirms the container exists; nothing on ContainerDto isn't already synthesized from the module
  get().subgraphProvenanceById.set(String(module.subgraphId), 'newly-created'); // caller-owned, stamped before merge
  get().applyComponentCollection({spfModules: [module], dataLinks: [], controlLinks: []});
  // recomputeContainersAndSubgraphs (inside applyComponentCollection above) synthesizes
  // the Subgraph/Container entries from the module alone; overlay subgraphType/SGKV
  // from the queried SubgraphDto onto that synthesized entry as a second step —
  // see node-operations-design.md's Sequence: Module Drop on Empty Canvas for the
  // full flow, including the partial-state failure mode this two-round-trip shape introduces
}
```

**What does *not* go through this mechanism.** Endpoints that only ever
mutate one already-known entity's own field — renames (REQ-010/017/031c/057),
`updatePortCount` (REQ-033–037, returns `{updatedPorts}`), and CKV/TKV
edits (REQ-053) — keep their existing narrow response shapes. There is no
collection to reconcile when the caller already knows exactly which single
entity/field changed, and forcing those through `ComponentCollectionDto`
would only add indirection. The line: if a response can affect more than
one entity, or an entity the client didn't already have the ID for, it
uses `ComponentCollectionDto`; otherwise it returns just what changed.

**Read-only placement fetches are also excluded.** `getSubgraphContents`
and `getSubgraphPairs` (REQ-012/013, `node-operations-design.md`) are not
staged backend mutations — the requirements doc explicitly calls placement
session-local, not staged — so they are merged into `GraphDataSlice`
directly by REQ-012/013's own placement logic, which also has to seed
`kvCases` (`kv-key-configuration-design.md`) and stamp
`provenance: 'palette-placed'`: session-local concerns specific to that
flow, not a fit for the generic reconciler.

**Batch operations apply multiple independent collections, not one merged
call.** `deleteSelection`'s batch delete (`canvas-ui-mechanics-design.md`)
issues one backend call per cascade root via `Promise.all`; each root's
response is a complete, self-contained `ComponentCollectionDto` applied via
its own `applyComponentCollection` call as it resolves. This is correct
without any extra merging step — Zustand's `set` calls compose sequentially
regardless of order, and each root's collection only ever touches entities
that root's own cascade is responsible for.

---

## Apply Changes

**REQ-044–046.** "Apply Changes" is only actionable in `mode: 'edit'` and
disabled while a previous Apply is in flight:

```typescript
interface EditSessionSlice {
  // ...mode state above...
  applyStatus: 'idle' | 'in-flight';
  modificationSummary: CreateUsecasesResponseDto | null;
  dismissSummary: () => void; // clears modificationSummary; see below
  applyChanges: () => Promise<void>;
}
```

**Apply Changes is the confirmed `POST /projects/{projectId}/usecases`
endpoint (`createUsecases`) — not an unconfirmed "routing/apply" endpoint.**
Its request/response DTOs are real and already in the API:

```typescript
interface SubgraphKvSelectionDto {
  systemId: string; // subgraph's own systemId
  valueSystemIds: string[][]; // one inner array per SGKV *case*; each inner array is the value systemIds active in that case
}

interface CreateUsecasesRequestDto {
  selectedUsecaseSystemIds: string[];
  activeSubgraphs: SubgraphKvSelectionDto[];
  excludedDataLinkSystemIds?: string[];
  excludedControlLinkSystemIds?: string[];
}

interface CreateUsecasesResponseDto {
  created: UsecaseIdentifierDto[];
  updated: UsecaseIdentifierDto[];
  deleted: UsecaseIdentifierDto[];
  issues: ApiIssueItem[]; // {code, message, severity: 'FATAL'|'ERROR'|'WARNING', category?, impactedEntity?, impactedUsecases?}
}
```

`applyChanges()` builds `activeSubgraphs`/`excludedDataLinkSystemIds`/
`excludedControlLinkSystemIds` by reading across sibling slices in the
same composed store via `get()` — a same-store cross-slice read, not a
cross-store concern:

- `selectedUsecaseSystemIds` — the selected use cases (`UsecaseSelectionSlice`)
- `excludedDataLinkSystemIds`/`excludedControlLinkSystemIds` — split from
  `EditSessionSlice.excludedLinkIds` (designed in `node-operations-design.md`)
  by each excluded link's own `connectionType`, since the request has two
  separate arrays rather than one combined list
- `activeSubgraphs` — one `SubgraphKvSelectionDto` per subgraph on canvas,
  built from that subgraph's **SGKV selection** (REQ-039–043,
  `kv-key-configuration-design.md`) — `systemId` is the subgraph's own ID,
  `valueSystemIds` is the selected KV cases in the shape that section's
  SGKV model produces

A single `applyStatus` flag is sufficient — Apply is one request, not many
concurrent per-operation calls like the rest of the feature.

**Subsystem Keys assignment (REQ-071) has no confirmed home in this
request or anywhere else in the API.** `SubsystemDto.filteredKeys` is a
read-only query field (populated on `queryComponentsInSubsystem`, etc.);
no mutation endpoint accepts a keys-assignment payload, and
`CreateUsecasesRequestDto` above has no field for it. This remains an open
item — see [Open Items Inherited](#open-items-inherited) — rather than a
resolved contract; `kv-key-configuration-design.md`'s `assignedKeyIds`
design still stands as the UI-side model, but nothing today confirms where
it's sent on Apply.

**Apply is blocked while any other operation is in flight, not only while a
previous Apply is in flight.** Because edits are already strictly serial
(`isMutating`, above), this falls out of the same mechanism rather than
needing a separate check: `applyChanges()` itself runs under
`withMutationLock`, so it cannot start while an unrelated add/delete/rename
is still awaiting its backend response, and no other edit can start while
Apply is running. The "Apply Changes" button's `disabled` condition is
`applyStatus === 'in-flight' || isMutating`, not `applyStatus` alone.

**Success and failure are both surfaced through the same summary view, not
a toast.** This is a deliberate departure from the rest of the feature's
"toast on failure" pattern. Unlike the rest of this feature's endpoints,
`createUsecases` doesn't have a binary success/fail response — it always
returns `200` with `created`/`updated`/`deleted`/`issues`; "failure" here
means `issues` contains entries with `severity: 'FATAL'` or `'ERROR'`
(`'WARNING'` entries are informational, not failures):

```mermaid
sequenceDiagram
  participant U as User
  participant ES as EditSessionSlice
  participant B as Backend

  U->>ES: click Apply Changes
  ES->>ES: applyStatus = 'in-flight'
  ES->>B: POST /projects/{projectId}/usecases (CreateUsecasesRequestDto)
  B-->>ES: CreateUsecasesResponseDto {created, updated, deleted, issues}
  ES->>ES: modificationSummary = result, applyStatus = 'idle'
  alt no FATAL/ERROR issues
    ES->>ES: exitEditMode() — releases lock, mode → 'view'
    Note over ES: canvas re-fetches/reconciles against committed backend state
  else FATAL/ERROR issues present
    Note over ES: mode stays 'edit', staged changes remain intact
  end
  ES->>U: render modification summary view (created/updated/deleted + issues)
```

On failure, the session **stays in Edit mode** — staged changes remain
intact, and the user reviews the failure details in the summary view before
either retrying Apply or manually Discarding. Nothing is auto-rolled-back.

**Summary view lifecycle.** The summary view opens automatically whenever
`modificationSummary` is non-null (both the success and failure case render
through it, per REQ-046) and is **modal** — it blocks further canvas
interaction, since on success the session has already exited to View mode
and on failure the user must consciously choose retry-Apply or Discard
before resuming editing. It is dismissed only by the explicit
`dismissSummary()` action (sets `modificationSummary` back to `null`), wired
to the summary view's own close button — there is no auto-dismiss on a
timer or on the next Apply click.

---

## Discard / Rollback

**REQ-061, plus the project-close case.** "Discard" is available at any
time during the edit session, and closing the project while in Edit mode
triggers the identical flow — REQ-061 explicitly unifies both triggers.

**Discard is the confirmed `POST /projects/{projectId}/discard-changes`
endpoint (`discardChanges`) — not an unconfirmed "rollback" endpoint.**
Its request/response DTOs are real:

```typescript
interface DiscardChangesRequestDto {
  changeIds?: string[]; // omitted or empty = discard every change
}

interface DiscardChangesResponseDto {
  success: boolean;
  processedChangeIds: string[];
  failedChangeIds: string[];
  message: string;
  cascadedChangeIds: string[]; // dependent changes discarded automatically
}
```

```typescript
interface EditSessionSlice {
  // ...
  discardConfirmationOpen: boolean;
  requestDiscard: () => void;          // opens the confirmation prompt
  confirmDiscard: () => Promise<void>; // sends the discard-changes request
  cancelDiscard: () => void;
}
```

`discardConfirmationOpen` lives on the slice (not local component state)
because the project-close trigger needs to reach it from outside the
Discard button's own component.

**`confirmDiscard()` calls `discardChanges` with `changeIds` omitted,
discarding the entire edit session's changes in one call — it does not
track individual `changeId`s to pass.** REQ-066's `changeId` per staged
edit is satisfied at the data layer already (every DTO's `changeInfo`
carries one once staged), but this feature has no use for granular discard
of a subset of changes; "Discard" always means "abandon everything staged
this session," matching `changeIds` being omitted/empty per the endpoint's
own documented behavior ("If changeIds is not provided or empty, all
changes will be discarded"). Dependent changes are cascaded server-side
(`cascadedChangeIds` in the response) — the frontend does not need to
compute or request that cascade itself.

**The discard response carries no graph payload, and `EditSessionSlice`
does not fetch graph data itself.** Unlike Apply Changes, `discardChanges`
only confirms the backend-side discard succeeded (or failed) — it returns
`success`/`processedChangeIds`/`failedChangeIds`/`message`/
`cascadedChangeIds`, no graph entities. Per the Architecture section above,
`EditSessionSlice` holds no graph data and must not reach into
`GraphDataSlice` directly; on `success: true` its only responsibility is
`exitEditMode()` (releases the lock, `mode → 'view'`). Fetching and
rendering the post-discard components is the responsibility of the
**view-mode session that mode switch starts** — the same rendering path
already used for ordinary use-case browsing.

That path is the existing load effect in
`packages/react-app/src/widgets/graph-designer/ui/graph-designer.tsx`
("Effect A", lines 277–300), which calls `loadGraphData(systemIds)`
whenever `selectedUsecases` changes. Discard does not change
`selectedUsecases`, so this effect's dependency list must gain `mode`.

**Guard the reset on `mode === 'view'`, not merely on `mode` changing.**
Effect A's body unconditionally clears search, level-view, collapse,
position-override, and viewport state before calling `loadGraphData` — if
`mode` is added to the dependency array naively, that reset also fires on
the `'view' → 'edit'` transition (clicking "Start Graph Modification"),
wiping REQ-059 position overrides and viewport/search state the instant
edit mode starts, which is not what REQ-061 asks for. Wrap the entire
existing body in `if (mode === 'view') { ... }` so it only runs on
transitions *into* `'view'` (initial mount, where `mode` is already
`'view'`, and the post-discard transition) — the `'view' → 'edit'`
transition must leave canvas state untouched.

```mermaid
sequenceDiagram
  participant U as User
  participant ES as EditSessionSlice
  participant B as Backend
  participant GDW as GraphDesigner widget (view-mode load effect)
  participant GD as GraphDataSlice

  U->>ES: requestDiscard() (via Discard button OR project-close interception)
  ES->>U: show confirmation prompt
  U->>ES: confirmDiscard()
  ES->>B: POST /projects/{projectId}/discard-changes {} (no changeIds — discard all)
  alt success: true
    B-->>ES: DiscardChangesResponseDto {processedChangeIds, cascadedChangeIds, ...}
    ES->>ES: exitEditMode() — releases lock, mode → 'view'
    Note over GDW: mode → 'view' transition observed (effect dependency)
    GDW->>GD: loadGraphData(selectedUsecases)
    GD->>B: POST /usecases/components/query for selected use cases
    B-->>GD: fresh component set (post-discard)
    GD->>GD: graphData repopulated
    Note over GDW: canvas re-renders read-only from fresh graphData
  else success: false
    Note over ES: error toast (failedChangeIds/message), mode stays 'edit', staged changes intact — retry available
  end
```

If the discard succeeds but the view-mode session's follow-up
`loadGraphData` call itself fails, that failure surfaces through
`GraphDataSlice`'s own `graphDataError`/`graphDataStatus` handling
(existing error path, not new here) — the lock has already been released
and `mode` is `'view'` at that point, since the discard itself succeeded;
the canvas shows the graph-data error state until the user retries (e.g.
by re-selecting the same use cases, which re-runs the same effect).

**Project-close interception.** `packages/react-app/src/features/project-operations/hooks/use-project-lifecycle.ts`'s
`handleProjectClose(projectId, projectName)` is the existing async
close-project flow (archives config, captures a screenshot, always resolves
`true` — there is no unsaved-changes confirmation dialog anywhere in this
path today). This flow must gain a check: if the closing project's Graph
Designer tab has `mode === 'edit'`, redirect into `requestDiscard()`'s
confirmation before proceeding, instead of closing silently. The existing
`onClose`/`OnGroupClose` confirmation hook already exists in
`widgets/project-layout/project-layout-manager.tsx`'s `createProjectMainTab`
signature but is unused at today's call site (`use-project-opener.tsx`) —
this is the mechanism to wire up, not new infrastructure.

**Discard failure (`success: false`):** shown as an error toast, consistent
with the generic backend-failure pattern used everywhere else in this
feature (REQ-008/029-style) — `message`/`failedChangeIds` from the response
populate the toast. The session stays in Edit mode with staged changes
intact; the user can retry Discard. There is no forced exit from Edit mode
on a failed discard.

---

## Open Items Inherited

`applyChanges()`/`createUsecases` and `confirmDiscard()`/`discardChanges`
are both now confirmed, real API contracts (above) — this document's
open items narrow to what those contracts don't cover:

- **Subsystem Keys assignment (REQ-071) has no confirmed backend home.**
  Neither `CreateUsecasesRequestDto` nor any other endpoint in the current
  API accepts a keys-assignment payload; `SubsystemDto.filteredKeys` is
  read-only. `kv-key-configuration-design.md`'s `assignedKeyIds` UI model
  still stands, but where/how it reaches the backend on Apply remains
  genuinely open — flagged for the backend team.
- **Batch/multi-entity creation for paste** — designed in
  `canvas-ui-mechanics-design.md`; the paste flow's own atomicity concern,
  unrelated to `createUsecases`, still has no confirmed endpoint.
