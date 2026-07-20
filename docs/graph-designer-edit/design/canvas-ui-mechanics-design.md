# Graph Designer Edit — Canvas UI Mechanics Design

Requirements: [../requirements/graph-designer-edit-requirements.md](../requirements/graph-designer-edit-requirements.md)
(REQ-011, 015, 019, 031e, 047–051, 058–059, 063–064, 069–070, 072;
REQ-068 explicitly out of scope — see below)

Covers the shared drag-and-drop validation mechanism, palettes, context
menus, the properties panel, position persistence, multi-select, port
coloring, and copy/paste. This document is the catch-all for canvas
interaction mechanics referenced but not designed in the other four
documents.

## Table of Contents

- [Out of Scope](#out-of-scope)
- [Shared Drag-and-Drop Validation](#shared-drag-and-drop-validation)
- [Palette Disabled in Subsystem Mode](#palette-disabled-in-subsystem-mode)
- [Context Menus](#context-menus)
- [Properties Panel](#properties-panel)
- [Positioning & Layout-Override Persistence](#positioning--layout-override-persistence)
- [Multi-Select & Batch Delete](#multi-select--batch-delete)
- [Port Coloring](#port-coloring)
- [Copy/Paste](#copypaste)
- [Open Items Inherited](#open-items-inherited)

---

## Out of Scope

**REQ-068 (quick actions).** Deferred to a future enhancement, same
treatment as undo/redo (REQ-067, see `core-edit-session-design.md`). Both
live under the requirements doc's "Enhancements" section and describe
optional UI improvements rather than must-have behavior for this pass.
Context menus (below) are the only interaction surface for node/edge
actions.

**Subsystem-mode / raw-mode toggle.** REQ-047 depends on a display concept
— "subsystem mode" shows subsystems for the selected use cases, "raw mode"
hides them entirely — that is common to both View and Edit mode and
predates this feature. It does **not currently exist in code**: no
state, UI control, or canvas-filtering logic implements it anywhere. The
closest things are two completely unwired preference fields,
`visualization.simplifySubsystems` and `usecases.mode` (both typed and
defaulted in `shared/config/user-preferences-types.ts`, neither read by any
rendering code). **Building this toggle is out of scope for Graph Designer
Edit** — it is assumed to be built separately and to exist by the time this
feature ships. This document designs only the consuming side of REQ-047,
below.

---

## Shared Drag-and-Drop Validation

**REQ-011, 019 — palette drop validation.** The module and subgraph
palettes use native HTML5 `dataTransfer` (confirmed: no DnD library is
present in this repo's dependencies), following the same MIME-sentinel
convention already established in the Visualizer's own design doc:

```javascript
event.dataTransfer.setData('application/json', JSON.stringify(payload));
event.dataTransfer.setData('application/x-audioreach-node-type-module', ''); // or '...-subgraph'
```

Each droppable node type's `onDragOver`/`onDrop` handler checks the payload
type against its own eligibility rules: `preventDefault()` only when valid,
`dropEffect = 'none'` plus an invalid-indicator CSS class otherwise.

| Drop target | Module-palette payload | Subgraph-palette payload |
| --- | --- | --- |
| Module node | Rejected (REQ-011 — modules are not containers) | Rejected (REQ-019 amended — module is subgraph content) |
| Container node | Valid (REQ-004) | Rejected (REQ-019 amended — container is subgraph content) |
| Subgraph node | Valid, outside any container (REQ-007) | Rejected (REQ-019) |
| Subgraph proxy node | Rejected (REQ-011 amended — proxy represents a collapsed subgraph, not a container) | Rejected (REQ-019 amended) |
| Empty canvas space | Valid (REQ-006) | Valid (REQ-012) — this is the *only* valid subgraph-palette drop target; every existing-node target above is rejected |
| Subsystem node | Rejected (REQ-011 amended — no auto-create chain into a subsystem is specified, unlike REQ-006/007's subgraph/container auto-create; applies in both raw and subsystem mode, since only the subgraph palette is disabled by REQ-047) | Not applicable in subsystem mode — the palette item itself is disabled (REQ-047), so there is no drag payload to validate. In raw mode the subsystem node isn't rendered at all, so this target cannot occur either. |

**REQ-011 was tightened during design**, in the same way as REQ-019 below.
The requirement's original text only covered module-onto-module. Two more
targets have no valid drop semantics and were previously left as `n/a` in
this table without a stated reason: a subgraph proxy node is a collapsed
subgraph, not a container, so there's nothing for a dropped module to join;
and a subsystem node has no auto-create chain analogous to REQ-006/007's
subgraph/container creation, so a drop there has no defined outcome. Both
are now explicit rejections in the requirements doc.

**REQ-019 was tightened during design.** The requirement's original text
("dropping a subgraph inside an existing subgraph") was ambiguous about
whether it covered the subgraph's own contents (a module or container is,
structurally, part of its parent subgraph — dropping onto one is really
dropping onto the subgraph) and subgraph proxy nodes. It has been amended
in the requirements doc to explicitly list all three rejected targets:
existing subgraph, that subgraph's contents, and proxy nodes. Dropping onto
a subsystem was considered and rejected as a fourth case — see the palette
section below for why it's handled differently.

**Empty canvas space is the only valid subgraph-palette drop target.**
REQ-012 ("place an existing subgraph onto the canvas by dragging from the
subgraph palette") *is* the empty-canvas-space case — every other row in
this table rejects the subgraph payload (REQ-019), and the subsystem row
never produces a drag payload at all while in subsystem mode (REQ-047).
There is no separate "drop subgraph here" target to design beyond this row.

**REQ-056 is a separate mechanism, not unified with this table.** Proxy-node
connection-target rejection is right-click connection validation (already
fully specified in `link-and-port-design.md`), not palette drag-and-drop.
Both share the phrase "invalid target" conceptually, but they run through
different interaction code paths (native `dataTransfer` events vs. the
Visualizer's internal connection-in-progress state) and are deliberately
not forced into one shared abstraction.

---

## Palette Disabled in Subsystem Mode

**REQ-047.** The subgraph palette is disabled entirely — every item
non-draggable, with a tooltip explaining the restriction — whenever the
canvas is in "subsystem mode" (see [Out of Scope](#out-of-scope) above for
what that means and why building it is not this feature's responsibility).
This document designs only the consuming side:

```typescript
// Assumed integration point, pending the (out-of-scope) raw/subsystem-mode
// toggle: a hook `useSubsystemDisplayMode(): 'raw' | 'subsystem'` that the
// toggle's own implementation is expected to expose. If that toggle has not
// landed by the time this feature ships, stub this hook to always return
// 'subsystem' so the palette is never spuriously disabled — do not block
// on the toggle's own delivery. Note the stub value itself must disable the
// palette (see isSubsystemMode below), so a 'subsystem' stub is only safe
// once paired with the corrected condition — see the correction note below.
const isSubsystemMode = useSubsystemDisplayMode() === 'subsystem';
const isDuplicatePlacement = placedSubgraphIds.has(item.subgraphId); // REQ-015, node-operations-design.md

const disabled = isSubsystemMode || isDuplicatePlacement;
const tooltip = isSubsystemMode
  ? 'Not permitted while the canvas is in subsystem mode'
  : isDuplicatePlacement
    ? 'Already present on the canvas'
    : undefined;
```

**Correction: an earlier draft of this snippet checked `isRawMode` (`useSubsystemDisplayMode() === 'raw'`), the literal opposite of REQ-047.** REQ-047 states the subgraph palette is disabled while the canvas is in **subsystem** mode, not raw mode — stated identically by the requirements doc, the LLD's condensed table, and `node-operations-design.md`'s REQ-019 section. The earlier draft's `isRawMode` condition, and its "stub to always return `'subsystem'` so the palette is never spuriously disabled" reasoning, both assumed the wrong polarity: stubbing the hook to `'subsystem'` under the old `isRawMode` check would have left the palette *enabled* by default (since `useSubsystemDisplayMode() === 'raw'` is false for a `'subsystem'` stub) — backwards from the stated fallback intent, which is for the palette to behave as if the (not-yet-built) toggle defaults to a state that does not spuriously disable it. Corrected: the condition is `isSubsystemMode`, and the same `'subsystem'` stub value now correctly falls into the disabled branch — matching this section's *intended* fallback design decision (below), not contradicting it.

**Corrected fallback behavior, given the fix above.** If the raw/subsystem toggle hasn't landed by ship time and the stub always returns `'subsystem'`, the subgraph palette would always be disabled under the corrected condition — the opposite of "never spuriously disabled." Since the toggle is explicitly out of scope and its actual default is undecided by this feature, the stub's default value must instead be `'raw'` (not `'subsystem'`) to preserve the original intent — the palette stays enabled until a real toggle exists to disable it. This is a correction to the stub's assumed default value, not a new design decision: the hook's *shape* (`useSubsystemDisplayMode(): 'raw' | 'subsystem'`) and the principle "don't block on the toggle's own delivery" are unchanged from the earlier draft; only which literal value the stub returns is corrected, to stay consistent with the now-corrected `isSubsystemMode` check above.

Because the subgraph palette is disabled whenever `isSubsystemMode` is true,
there is never a subgraph-palette drag payload to validate against a
subsystem drop target while that mode applies — this is why the table
above marks that cell "not applicable" rather than "rejected": there's no
drag operation to reject in the first place. (The module-palette column
for the same row is a real rejection, not an absence — the module palette
stays enabled regardless of raw/subsystem mode, so a module-onto-subsystem
drag payload does exist and REQ-011 must reject it.) If a future change
makes subsystem-mode toggling possible mid-drag, this assumption would
need revisiting, but no such case exists today.

**REQ-015 — duplicate-placement guard.** `placedSubgraphIds` is a
derived read from `GraphDataSlice`, comparing the palette entry's own
`subgraphId` against currently-placed subgraph nodes' `subgraphId` — there
is no separate definition ID for subgraphs, unlike modules (see
`node-operations-design.md` for why). This section owns only the
palette's rendering of the disabled state and tooltip text.

---

## Context Menus

**REQ-048 — node delete dispatch.** Right-click a node → Delete → behavior
branches on node type, using the `provenance` field from
`node-operations-design.md` for subgraphs:

| Node type | Delete behavior |
| --- | --- |
| Palette-placed subgraph | UI-cache-only removal, no backend call — `removeFromUiCacheOnly` (`node-operations-design.md`'s Subgraph Provenance section) |
| Pre-loaded subgraph | Staged backend delete (`deleteSubgraph`) |
| Newly-created subgraph | Staged backend delete (`deleteSubgraph`) — same action as pre-loaded; the backend cascades to containers/modules/links either way (`node-operations-design.md`) |
| Module | Staged backend delete (`deleteModuleInstance`) |
| Container | Staged backend delete (`deleteContainer`) |

This is a pure dispatch table — no new state. The handler calls whichever
action already designed in `node-operations-design.md`/`link-and-port-design.md`
applies to the selected node's type.

**REQ-049 — edge delete.** Right-click an edge → Delete → calls `deleteLink`
(`link-and-port-design.md`). **Except for a pair-derived edge**
(`pairLinksById.has(connectionId)`, `node-operations-design.md`'s Bridge
Connections section) — that edge's context menu shows "Exclude Link"
instead of "Delete" in the first place (`link-and-port-design.md`), so
REQ-049's Delete path never applies to it via the menu. The Delete
key/batch-delete path below reaches the same edge type through
`deleteSelection`/`deleteByType`, which has no context-menu rendering to
rely on for this exclusion — see the `pairLinksById` check inside
`deleteByType`, below, which routes a pair-derived edge to `excludeLink`
instead of `deleteLink` so this rule holds regardless of entry point.

**REQ-050 — Delete key parity.** The Delete key must trigger the *same*
underlying dispatch as the context menu's Delete option, for whatever is
currently selected — not a duplicate implementation that could drift. Both
entry points call one shared function:

```typescript
function deleteSelection(selection: Selection): Promise<void>
```

(Extended further in [Multi-Select & Batch Delete](#multi-select--batch-delete)
below.)

**REQ-072 — "Offload to other DSP" menu item.** Right-clicking a module
adds a second context-menu entry beyond Delete: "Offload to other DSP,"
which opens a submenu/dialog listing available target DSPs:

```typescript
interface DspOption {
  id: string;
  label: string;
}
```

The fetch source for this list (the use case's known DSP set vs. a
project-wide DSP list) is still TBD with the backend team
(`link-and-port-design.md`'s Open Items) — but the shape above is fixed so
the dropdown/list UI can be built now against a mocked
`DspOption[]` and wired to the real source once it's confirmed. This
document owns only the menu item and DSP picker UI; the backend contract
and canvas reconciliation for the offload itself (`offloadModuleToDsp`, the
IPC TX/RX upsert response shape, and its interaction with REQ-055's
display-mode preference) are designed in `link-and-port-design.md`'s
[Offload to Other DSP](../design/link-and-port-design.md#offload-to-other-dsp)
section. Selecting a target DSP calls that action directly — there is no
separate confirmation step beyond the picker itself, consistent with how
"Move to Subsystem" (REQ-031a, `node-operations-design.md`) also prompts
for a target and then acts immediately on selection.

**REQ-031e — "Remove from Subsystem" menu item.** Right-clicking a
subgraph or subsystem node whose current parent is itself a subsystem adds
a context-menu entry beyond Delete: "Remove from Subsystem" — shown only
when that parent-is-a-subsystem condition holds, symmetric to REQ-031a's
"Move to Subsystem" (which is available on any subgraph/subsystem
regardless of current parent). Selecting it calls `removeFromSubsystem`
directly, with no intermediate picker — there is only one destination
("one level up"), unlike "Move to Subsystem," which must first ask which
subsystem. This document owns the menu item; the backend contract and
canvas reconciliation are designed in `node-operations-design.md`'s
Subsystem Operations section.

---

## Properties Panel

**REQ-051.** Selecting a node opens the existing properties panel
(`widgets/properties-panel/`) with editable fields composed from
already-designed actions:

| Field | Node types | Backing action |
| --- | --- | --- |
| Name | Module, subgraph, subsystem, subgraph proxy | `renameModuleInstance`, `renameSubgraph`, `renameSubsystem`, `renameSubgraphProxy` (REQ-010/017/031c/057, `node-operations-design.md`/`link-and-port-design.md`) |
| Container ID | Container | `updateContainerId` (REQ-023) |
| Data port count | Module, subsystem | `updatePortCount` (REQ-033/036) |
| Control port count | Module, subsystem | `updatePortCount` (REQ-034/037) |

No name field is shown for containers (REQ-021). This is a composition
exercise over the panel widget's existing structure and the actions
designed elsewhere — no new state or backend contract.

---

## Positioning & Layout-Override Persistence

**REQ-058 — exact drop coordinates.** Auto-layout (ELK) must not reposition
a newly-dropped component away from its drop point. This is largely already
satisfied by the existing architecture: ELK only runs once, at initial
`LevelView` construction (`widgets/graph-designer/lib/level-view-layout.ts`),
and never re-runs on drag or drop. What this document confirms is that the
palette-drop code path passes the raw drop coordinates straight through to
the new node's `position`, and that parent auto-resize (`resizedParents`,
fired via `onNodeDragEnd`) only resizes ancestor bounding boxes around the
dropped node — it never relocates the dropped node itself.

**REQ-059 — drag-to-reposition, available in both View and Edit mode.**
Position changes apply to the canvas immediately but are explicitly **not**
staged as part of the edit workflow — they persist separately as "layout
overrides." The client-side mechanism already exists today and needs no
edit-mode-specific handling: `onNodeDragEnd` reports the final position
(plus `resizedParents`) to the consumer, which stores `positionOverrides`/
`parentSizes` and merges them via `apply-position-overrides.ts`. This
document confirms that mechanism applies unchanged in Edit mode.

**Backend persistence is explicitly left unspecified.** The requirements
doc itself marks this an open item TBD with the backend team; this document
does not propose a candidate endpoint, to avoid implementation mistaking a
placeholder for a real contract. Only the client-side contract above is
designed.

---

## Multi-Select & Batch Delete

**REQ-063.** Multi-select (Shift+click or rubber-band drag-select) is
available in both View and Edit mode. In Edit mode, batch Delete must
respect cascade ordering: **if a parent and child are both selected, the
child's delete is handled as part of the parent's cascade and is not issued
as a separate operation.**

This means `deleteSelection` (from [Context Menus](#context-menus) above)
cannot loop and call one delete-per-item naively — that would double-delete
in cases like a container and its own module both being selected. It needs
a pre-pass that also drops any selected edge whose endpoint node is covered
by another selected node's cascade (an edge is not its own "ancestor" case,
but deleting a node that contains — or *is* — its endpoint already implies
deleting the edge too — issuing a separate `deleteLink` for it afterward
would race against, or duplicate, that cascade). **This coverage check must
walk the endpoint's actual containment chain, not just compare against the
raw set of individually-selected node IDs** — a container and an edge whose
endpoint module lives inside that container (but was never itself
separately selected) is exactly the case a literal-membership check misses,
below:

```typescript
// A normalized view over whatever node/edge the selection contains —
// `kind` discriminates dispatch in deleteByType below; `parentId` is each
// node type's own containment field (container's subgraphId, module's
// containerId, subgraph's parentId if inside a subsystem, etc.), read via
// a small per-kind accessor, not a literal shared field name.
interface Selectable {
  id: string;
  kind: 'module' | 'container' | 'subgraph' | 'subsystem' | 'edge';
  parentId?: string; // absent for 'edge' and for top-level nodes
  provenance?: SubgraphProvenance; // present only when kind === 'subgraph'
  sourceNodeId?: string; // present only when kind === 'edge'
  targetNodeId?: string; // present only when kind === 'edge'
}

function isAncestorOf(candidateAncestor: Selectable, item: Selectable): boolean {
  // Walk item's containment chain (module -> container -> subgraph ->
  // subsystem, via each node's own parentId/containerId/subgraphId field)
  // until it either reaches candidateAncestor.id (true) or the root (false).
  let current: Selectable | undefined = item;
  while (current?.parentId) {
    if (current.parentId === candidateAncestor.id) return true;
    current = getNodeById(current.parentId);
  }
  return false;
}

// True if `nodeId` is itself one of `roots`, or a descendant of any of
// them — walks the *actual* node graph via getNodeById, not just the raw
// selection array, because an edge's endpoint can be a node that was never
// separately selected (e.g. a module inside a selected container).
function isCoveredByRootCascade(nodeId: string, roots: Selectable[]): boolean {
  if (roots.some((r) => r.id === nodeId)) return true;
  const node = getNodeById(nodeId);
  return node ? roots.some((r) => isAncestorOf(r, node)) : false;
}

function deleteByType(item: Selectable): Promise<void> {
  // Literal dispatch over the REQ-048 table — no new logic beyond routing
  // to the action each node/edge type already has designed elsewhere:
  switch (item.kind) {
    case 'subgraph':
      return item.provenance === 'palette-placed'
        ? removeFromUiCacheOnly(item.id) // no backend call, REQ-016a
        : deleteSubgraph(item.id); // node-operations-design.md
    case 'module':
      return deleteModuleInstance(item.id); // node-operations-design.md
    case 'container':
      return deleteContainer(item.id); // node-operations-design.md
    case 'subsystem':
      return deleteSubsystem(item.id); // node-operations-design.md
    case 'edge':
      // Pair-derived edges (link-and-port-design.md's Bridge Connections
      // section) must never reach deleteDataLink/deleteControlLink — that
      // rule is stated there for the context-menu path, but the Delete
      // key/batch-delete path funnels through this same function and would
      // otherwise violate it silently. Route to the same Exclude Link
      // action the context menu offers instead: no backend call, the
      // connection stays intact server-side, only its on-canvas rendering
      // is removed (REQ-014/014a) — exactly what the context menu's only
      // available action for this edge type already does.
      return get().pairLinksById.has(item.id)
        ? Promise.resolve(get().excludeLink(item.id)) // node-operations-design.md
        : deleteLink(item.id); // link-and-port-design.md
  }
}

function deleteSelection(selection: Selectable[]): Promise<void> {
  if (get().mode !== 'edit') return Promise.resolve(); // Delete key fires in View mode too (REQ-063) — no-op, not an error
  if (get().isMutating) return Promise.resolve(); // core-edit-session-design.md — no-op while a mutation is already in flight
  const selectedNodes = selection.filter((item) => item.kind !== 'edge');
  const roots = selectedNodes.filter(
    (item) => !selectedNodes.some((other) => isAncestorOf(other, item)),
  );
  // A selected edge is dropped if either endpoint is covered by a root's
  // own cascade — not merely if the endpoint was itself individually
  // selected. Checking only literal selection membership (an earlier draft
  // of this function compared against `selectedNodeIds`, the raw selected
  // node IDs) misses the case where a container and an edge are both
  // selected but the edge's actual endpoint module — inside that
  // container, and itself never separately selected — is not in that set:
  // the edge would wrongly be classified "surviving" and get its own
  // deleteLink call racing the container's own cascade delete inside the
  // same Promise.all below (deleteSelection's internal concurrency is not
  // covered by the app-wide "one mutation at a time" serialization, since
  // the whole batch is one locked operation — see core-edit-session-design.md).
  const survivingEdges = selection.filter(
    (item) =>
      item.kind === 'edge' &&
      !isCoveredByRootCascade(item.sourceNodeId!, roots) &&
      !isCoveredByRootCascade(item.targetNodeId!, roots),
  );
  const items = [...roots, ...survivingEdges];
  return withMutationLock(async () => {
    const results = await Promise.allSettled(items.map((item) => deleteByType(item)));
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length > 0) {
      // Each root/edge is deleted independently — successes are already
      // merged into GraphDataSlice by the time any failure is known, and
      // are never rolled back. One aggregate toast reports the count; the
      // per-item failure reasons go to the log, not the toast body (REQ-063a).
      for (const [i, failure] of failures.entries()) {
        logger.error('deleteSelection: item failed', {item: items[results.indexOf(failure)], reason: failure.reason});
      }
      toast.error(`${items.length - failures.length} of ${items.length} deletions succeeded`);
    }
  });
}
```

**Partial failure is expected, not exceptional — REQ-063a.** Each
root/surviving-edge delete is an independent backend call; `Promise.all`
(an earlier draft's choice) would reject the whole batch on the first
failure, discarding visibility into which of the *other* calls had already
succeeded and been merged by the time the rejection surfaced. `Promise.allSettled`
lets every independent delete run to completion regardless of any other's
outcome, matching what actually happens in `GraphDataSlice` — every
succeeding root's `applyComponentCollection` call has already merged by the
time the batch resolves, and nothing rolls that back for a sibling's
failure. The user sees one aggregate toast ("N of M deletions succeeded");
per-item failure detail (which root, what error) goes to the log, not the
toast body, consistent with the toast being a count-level summary rather
than an enumeration.

**The whole batch runs under one `beginMutation`/`endMutation` pair, not
one per root.** `deleteSelection` is a single user-initiated action, so its
internal `Promise.all` over multiple roots is one mutation from
`isMutating`'s perspective — this is intentional concurrency *within* one
locked operation, not a violation of the "one mutation at a time" rule,
which only prevents a *second, independently-triggered* action from
starting before this one finishes. The top-of-function `mode`/`isMutating`
checks additionally guard against the Delete key being pressed in View
mode, or pressed again (or the context-menu Delete clicked) while a
previous batch — or any other edit — is still in flight; REQ-050's
Delete-key/context-menu parity means both entry points reach this same
guarded function. The `mode` check here is a plain no-op, not the thrown
error `withMutationLock` uses (`core-edit-session-design.md`) — pressing
Delete on a View-mode selection is an expected, normal user action
(REQ-063 explicitly permits selection in View mode), not a bug, so it
must fail silently rather than surface an error.

Pure client-side filtering logic — no new backend contract; each root's
delete call already cascades to its selected descendants per
`node-operations-design.md`/`link-and-port-design.md`.

---

## Port Coloring

**REQ-064.** Port coloring is a pure derived value, not stored state, based
on connection visibility relative to the currently-selected use cases —
**module ports only; subsystem ports are explicitly out of scope**, per
REQ-064's own text:

| Color | Condition |
| --- | --- |
| Black | All connections to this port belong to selected use cases and are present on canvas |
| Grey | Some connections' use cases are selected, some are not |
| White | No connections on this port |

**Data source.** The on-canvas connection count for a port is the number of
edges in `GraphDataSlice.connections` referencing that port ID (only
connections belonging to the currently-selected use cases are ever loaded
into `GraphDataSlice`, so this count is inherently selection-scoped). The
*total* connection count, independent of selection, comes from
`DataPortDto.totalLinksAtPort` (`entities/usecases/model/usecase-component.dto.ts`),
which is populated for every port regardless of which use cases are
selected. A port is:

- **White** if `totalLinksAtPort === 0`.
- **Black** if `totalLinksAtPort > 0 && onCanvasCount === totalLinksAtPort`
  (every connection this port has belongs to a selected use case).
- **Grey** if `totalLinksAtPort > 0 && onCanvasCount !== totalLinksAtPort`
  — this covers not only the "some but not all" case
  (`0 < onCanvasCount < totalLinksAtPort`) but also `onCanvasCount === 0`
  with `totalLinksAtPort > 0`: a port whose only backend connection is a
  pair-rendered link the user has excluded (REQ-014). Excluding removes the
  link from `graphData.connections` (so `onCanvasCount` drops to `0`) but
  deliberately does not touch `totalLinksAtPort`, since the link still
  exists server-side (see below) — so this port has connections the backend
  knows about that are not currently visible on canvas, the same underlying
  condition Grey represents for the "some selected, some not" case, not a
  fourth color of its own.

Computed by the port-handle component (`ui/node-types/port-handles`) from
existing connection data and the existing use-case-selection state already
present elsewhere in the app — no new state.

**`totalLinksAtPort` must be added to the frontend `Port` type — it is not
threaded through today.** `graph-data-slice.ts`'s current module-mapping
loop builds each `Port` as `{direction, isStatic, portId, portName,
portType}`, dropping `DataPortDto.totalLinksAtPort` entirely (confirmed by
reading the mapping code — no field carries it through). This is a
prerequisite gap this feature must close, not something already working
that this document can assume:

```typescript
interface Port {
  // ...existing fields...
  totalLinksAtPort: number; // new — copied from DataPortDto.totalLinksAtPort at mapping time
}
```

Every place that constructs a `Port` from a `DataPortDto` — the initial
`loadGraphData` mapping and, per below, `applyComponentCollection`'s
module upsert — must copy this field across, exactly as the other four
fields already are.

**`totalLinksAtPort` must be adjusted client-side on both link creation and
link deletion — the backend response never carries the correction for
either direction.** `createDataLink`/`createControlLink`'s response
(`link-and-port-design.md`) carries the new link itself in
`addedComponentCollectionDto`, but never the two endpoint modules whose
ports just gained a connection (unless one of those modules happened to be
created in the very same response, e.g. REQ-027's bridge modules) — same
shape asymmetry as delete, just the opposite direction.
`deleteModuleInstance`/`deleteContainer`/`deleteSubsystem`'s response
similarly carries the deleted link(s) in `deletedComponentCollectionDto`
but never the *surviving* sibling endpoint whose port just lost a
connection. Confirmed same-selection-scope in both cases: `totalLinksAtPort`
counts only links within the currently-selected use cases, the same scope
`GraphDataSlice.connections` already lives in — so a plain
increment/decrement-by-one per created/severed connection is correct with
no cross-scope adjustment needed, unlike a naive assumption that it might
count links from unselected use cases too.

```typescript
function adjustSurvivingPortCounts(
  state: GraphDesignerStore,
  addedLinks: Array<DataLinkDto | ControlLinkDto>,
  deletedLinks: Array<DataLinkDto | ControlLinkDto>,
): void {
  for (const link of addedLinks) adjustPortForLink(state, link, +1);
  for (const link of deletedLinks) adjustPortForLink(state, link, -1);
}

function adjustPortForLink(state: GraphDesignerStore, link: DataLinkDto | ControlLinkDto, delta: number): void {
  // sourceId/destinationId are numeric backend IDs — resolve to the
  // module's own systemId the same way loadGraphData's numericIdToSystemId map already does
  for (const [moduleNumericId, portNumericId] of [
    [link.sourceId, link.sourcePortId],
    [link.destinationId, link.destinationPortId],
  ]) {
    const module = findModuleByNumericId(state, moduleNumericId); // undefined if this endpoint was itself deleted, or is a subsystem rather than a module — see below; either way, nothing to adjust
    if (!module) continue;
    const port = [...module.inputPorts, ...module.outputPorts].find((p) => p.portId === String(portNumericId));
    if (port) port.totalLinksAtPort += delta;
  }
}
```

**A link endpoint that is a subsystem, not a module — REQ-027's A→B hop of
a cross-subsystem bridge — is deliberately not resolved here, by
construction, not as a gap.** `findModuleByNumericId` only ever looks up
`state.graphData.moduleInstances`; for the subsystem→subsystem hop of a
REQ-027 bridge, both endpoints resolve to `undefined` and are skipped, the
same code path as an already-deleted endpoint. This is intentional, not an
oversight: `totalLinksAtPort`/port coloring (REQ-064, above) is a
module-port concept only — subsystems have their own port *counts*
(REQ-036/037) but this feature does not extend REQ-064's black/grey/white
coloring to subsystem ports, so there is no `totalLinksAtPort`-equivalent
field on a subsystem port for this function to adjust in the first place.

This runs as one more step inside `applyComponentCollection`
(`core-edit-session-design.md`), alongside the existing
`recomputeContainersAndSubgraphs`/`pruneDeletedLinkBookkeeping` calls —
same reconciler, same single-pass-over-the-response pattern, covering
every added/deleted link in the feature (ordinary create, ordinary
delete, and any cascading delete that severs links), not a
delete-module-specific or create-specific special case. Because this
function runs *after* the module upserts have already merged every
module in the same response, an added link whose endpoint module is
itself newly-created in the same response (e.g. REQ-006's auto-create, or
REQ-027's bridge modules) is found correctly — the module already exists
in `moduleInstances` by the time this runs, with its new port(s) already
defaulted to `totalLinksAtPort: 0` (`updatePortCount`'s section,
`link-and-port-design.md`) where applicable, so the increment lands on a
real port rather than being silently skipped. **A link endpoint that was
itself deleted in the same cascade is silently skipped**, not an error: if
the whole container/subgraph emptied out, every module in it — including
both endpoints of some severed links — is gone, and there is no surviving
port to adjust for those. `findModuleByNumericId` looks the endpoint up
*after* the module upserts have already removed every deleted module from
`moduleInstances`, so a deleted endpoint naturally returns `undefined`
here without needing a separate check against the deleted-IDs list.

**Links present only in `updatedComponentCollectionDto` (REQ-072's
rerouted links) are deliberately not handled by this function, and are
flagged as a follow-up gap, not silently ignored.** DSP offload reroutes a
module's existing links through a new IPC TX/RX pair — the link's *old*
endpoint loses the connection and the IPC module's port gains it, but the
response (`link-and-port-design.md`'s `offloadModuleToDsp`) only carries
the link's *new*, post-reroute `sourceId`/`destinationId`; nothing in the
confirmed response shape carries the pre-reroute endpoint needed to
decrement it. Closing this requires either a backend contract addition
(the old endpoint included alongside the new one) or a client-side
before/after diff against the link's previously-stored endpoints — neither
is designed here. Until resolved, a port on the offloaded module's
original DSP that loses a rerouted link keeps a stale (too-high)
`totalLinksAtPort`, and the new IPC module's port — freshly created in the
same response — is unaffected since new ports default to `0` regardless
(`updatePortCount`'s section, `link-and-port-design.md`). Tracked in [Open
Items Inherited](#open-items-inherited), below.

**REQ-014's exclusion/reversal flow does not go through this function —
excluding or un-excluding a pair-link never touches `totalLinksAtPort`.**
`excludeLink`/the reversal branch in `handleEdgeConnected`
(`node-operations-design.md`/`link-and-port-design.md`) only move a
`Connection` object between `graphData.connections` and `excludedLinks` —
no backend call, and critically, no change to the link's *existence*
server-side. `totalLinksAtPort` reflects the backend's true connection
count, which is unaffected by whether the link happens to be rendered on
canvas — REQ-013 already established the link exists server-side
regardless of exclusion, so its contribution to both endpoints'
`totalLinksAtPort` must stay exactly as loaded, neither incremented nor
decremented by exclusion or reversal.

---

## Copy/Paste

**REQ-069–070.** Clipboard state is internal to the app (`clipboardBuffer`,
not the OS clipboard) — a snapshot of selected nodes plus edges *between*
selected nodes only. Edges to components outside the selection are excluded
on both copy and cross-level paste (REQ-070).

**Trigger → position mapping.** Two paste entry points exist, each resolving
position differently:

- **Ctrl+V** (keyboard shortcut, canvas focused): pastes at the last known
  pointer position over the canvas, if one has been recorded since the
  canvas was last focused (tracked via the canvas's existing
  `onPointerMove`); otherwise (e.g. paste immediately after tabbing into
  the canvas with no mouse movement yet) falls back to the current
  viewport center.
- **Context-menu "Paste"** (right-click on empty canvas space): pastes at
  the exact point that was right-clicked to open the menu — the same
  coordinate the context menu itself is anchored to.

**Both entry points call one shared `pasteSelection` function, guarded on
`mode` the same way `deleteSelection` is.** Ctrl+V is a global `keydown`
listener like the Delete key (`Multi-Select & Batch Delete`, above) —
copying is harmless in View mode (REQ-069/070 don't restrict Copy to Edit
mode), but Paste ultimately calls the same mutating actions
(`createModuleWithAutoCreate`, `pasteSubgraphFromSnapshot`, etc.) that
route through `withMutationLock` (`core-edit-session-design.md`), which
throws if `mode !== 'edit'` on the assumption that only an already
Edit-mode-gated UI surface could reach it. A stray Ctrl+V in View mode is
exactly the same "normal user action, not a bug" case as Delete, so it
needs the same no-op guard at its own entry point rather than surfacing
that thrown error:

```typescript
function pasteSelection(position: XY): Promise<void> {
  if (get().mode !== 'edit') return Promise.resolve(); // Ctrl+V fires in View mode too — no-op, not an error, same as deleteSelection
  // ...target resolution and dispatch, below
}
```

**Target container/subgraph resolution.** Once a raw `(x, y)` is chosen by
either trigger, the paste target is resolved the same way a drag-drop
target is (see [Shared Drag-and-Drop Validation](#shared-drag-and-drop-validation)
above): a hit-test against on-canvas node bounding boxes at that point.

**The hit-tested target is validated against the same drop-target rules as
drag-and-drop before paste proceeds — REQ-011/019, tightened to also cover
paste.** An earlier draft of this section only used the hit-test to
*classify* the target (container / subgraph / empty space) and never
checked whether the classified target was actually a *valid* one — nothing
stopped a paste from landing directly on a module node, a subgraph proxy
node, or a subsystem, targets the drag-and-drop table above explicitly
rejects for the same payload kinds. The fix: run the hit-tested target
through the same eligibility check `onDragOver`/`onDrop` use (the table in
[Shared Drag-and-Drop Validation](#shared-drag-and-drop-validation)),
keyed by the clipboard's own content kind (a snapshot containing a subgraph
uses the subgraph-palette row; a snapshot of only modules/containers uses
the module-palette row) before doing anything else. An ineligible target
rejects the paste outright — same invalid-target feedback as a rejected
drag-and-drop, no backend call:

- If the point falls inside a container, modules/containers paste into
  that container (valid per REQ-004's row).
- If inside a subgraph but outside any container, REQ-007's
  `createModuleWithAutoCreate` (with `existingSubgraphId` set) semantics
  apply (valid per REQ-007's row).
- If on empty canvas space, REQ-006's `createModuleWithAutoCreate` (both
  IDs omitted) semantics apply (valid per REQ-006's row; also the *only*
  eligible target when the clipboard contains a subgraph, mirroring
  REQ-012/019 — a subgraph paste hit-testing onto a module, container,
  existing subgraph, proxy node, or subsystem is rejected the same way the
  equivalent subgraph-palette drop would be).
- Any other hit-tested target (module node, subgraph proxy node, subsystem
  node — or, for a subgraph-bearing clipboard, anything other than empty
  space) is rejected before any backend call, with the same invalid-target
  visual feedback REQ-011/019 already define for drag-and-drop.

This reuses the exact target-classification *and* eligibility rules the
drop-validation table already defines — paste does not introduce a second
hit-testing mechanism or a second validation table.

**Copyable node types: modules, containers, and subgraphs.** Subsystems are
not a copyable unit — they appear in REQ-070 only as the *context* pasted
into or out of ("outside a subsystem," "into a different subsystem").

```typescript
interface ClipboardBuffer {
  nodes: Array<ModuleInstance | Container | Subgraph>;
  internalEdges: Connection[]; // only edges where both endpoints are in `nodes`
}
```

**Paste behavior branches by node type:**

- **Modules/containers**: replay the existing add-module action
  (`node-operations-design.md`'s `addModuleInstance`/
  `createModuleWithAutoCreate`) per pasted instance, targeting the
  container/subgraph the paste lands in. If the paste position lands on
  **empty canvas space** rather than an existing container/subgraph, this
  mirrors REQ-006's behavior — `createModuleWithAutoCreate` runs (with its
  own module-create-then-query flow, per that section), creating whatever
  intermediate structure (subgraph, container) is needed to place the
  pasted node(s), rather than being disallowed. Inter-connections from the
  snapshot are recreated via the existing link-creation action
  (`link-and-port-design.md`) once the pasted nodes exist.
- **Subgraphs**: pasting a subgraph creates a **brand-new** backend
  subgraph populated with the copied contents — it does not alias or
  reference the original:

  ```typescript
  pasteSubgraphFromSnapshot(
    snapshot: {containers: Container[]; modules: ModuleInstance[]; links: Connection[]},
    position: XY,
  ): Promise<{
    addedComponentCollectionDto: ComponentCollectionDto;
    updatedComponentCollectionDto: ComponentCollectionDto;
    deletedComponentCollectionDto: ComponentCollectionDto;
  }>
  // addedComponentCollectionDto.spfModules = every pasted module, each
  //   carrying its new subgraphId/containerId — subgraph/container are
  //   derived from these, same as REQ-006 (core-edit-session-design.md)
  // addedComponentCollectionDto.dataLinks/controlLinks = the recreated internal connections
  // updated/deletedComponentCollectionDto are always empty — paste is pure-create
  ```

  Parallel to REQ-006's `createModuleWithAutoCreate`, but accepting a full
  snapshot instead of a single module, and merged the same way — via
  `applyAddedCollection` (`core-edit-session-design.md`), which derives
  the new subgraph/containers purely from the pasted modules' own fields.
  The caller stamps `provenance: 'newly-created'`
  (`node-operations-design.md`) into `EditSessionSlice.subgraphProvenanceById`
  for the new subgraph ID before passing the collection to the reconciler,
  the same as drag-to-empty-space.

**REQ-070 — cross-level connection replication.** For each edge in the
snapshot, if both endpoints were pasted, attempt to recreate it in the new
context via the normal link-creation action, letting the backend's own
validation (REQ-029) reject it if invalid at the new level. Edges where only
one endpoint was in the original selection are dropped entirely — never
sent to the backend.

```mermaid
sequenceDiagram
  participant U as User
  participant CB as clipboardBuffer
  participant B as Backend

  U->>CB: Copy (selection + internal edges snapshotted)
  U->>CB: Paste (at viewport center or cursor, possibly a different hierarchy level)
  alt snapshot contains a subgraph
    CB->>B: pasteSubgraphFromSnapshot(snapshot, position)
    B-->>CB: addedComponentCollectionDto (pasted modules/links; provenance stamped 'newly-created' before merge)
  else modules/containers only
    loop each node in snapshot
      CB->>B: existing add-module/add-container action
    end
    loop each internalEdge where both endpoints pasted
      CB->>B: existing link-creation action (may be rejected per REQ-029)
    end
  end
```

**Batch creation is flagged as a new backend open item, not assumed to work
via sequential calls.** A paste can create many entities in one user
action. Sequential single-entity calls (one per module/container/link,
awaited in order) would permit silent partial-paste failure — some entities
created, then one fails mid-sequence — with no requirement addressing that
failure mode. This document does not design around that fallback; instead
it flags the need for a batch/multi-entity creation contract (see
[Open Items Inherited](#open-items-inherited)).

---

## Open Items Inherited

- **Position persistence mechanism** (REQ-059) — TBD with backend team, no
  candidate proposed here by design decision.
- **Batch/multi-entity creation for paste** — new open item added to the
  requirements doc: a batch-create endpoint (or equivalent atomic
  multi-entity contract, mirroring REQ-006's atomic creation) so a paste
  either fully succeeds or fully fails.
- **API contracts** for `pasteSubgraphFromSnapshot` and the subsystem/
  raw-mode toggle's exposed state shape (assumed to exist, not designed
  here) — both undefined as of this writing.
- **`totalLinksAtPort` correction for rerouted (`UPDATE`-tagged) links is
  unresolved** — see the Port Coloring section's `adjustSurvivingPortCounts`
  note, above. REQ-072's DSP offload reroutes existing links, and neither
  a backend contract addition (old endpoint included in the response) nor
  a client-side before/after diff is designed here; until resolved, a port
  that loses a rerouted link keeps a stale `totalLinksAtPort` count.

