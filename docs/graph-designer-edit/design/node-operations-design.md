# Graph Designer Edit — Node Operations Design

Requirements: [../requirements/graph-designer-edit-requirements.md](../requirements/graph-designer-edit-requirements.md)
(REQ-004–023, 031a–032)

Covers module, container, subgraph, and subsystem structural operations:
add, delete, rename, implicit creation, and subsystem move/expand. All
operations here assume the edit session designed in
`core-edit-session-design.md` is already active.

## Table of Contents

- [Shared Mutation Pattern](#shared-mutation-pattern)
- [Subgraph Provenance](#subgraph-provenance)
- [Module Operations](#module-operations)
- [Container Operations](#container-operations)
- [Subgraph Operations](#subgraph-operations)
- [Subsystem Operations](#subsystem-operations)
- [Open Items Inherited](#open-items-inherited)

---

## Shared Mutation Pattern

Every operation in this document follows the pattern established in
`core-edit-session-design.md`: a dedicated async action calls the backend,
merges the returned DTOs into `GraphDataSlice` only on success, and shows an
error toast with no canvas change on failure. Every action is also wrapped
in `core-edit-session-design.md`'s `isMutating` lock (REQ-065) so the
canvas is non-interactive until the response arrives. This section states
both patterns once; each operation below names only its action and
payload, not the wrapping.

**Cascading operations must return their full blast radius in one
response, using the shared `ComponentCollectionDto` shape.**
Several operations here (module delete, container delete, subgraph delete,
subsystem delete, subsystem expand) cascade to child entities and their
links. For the UI to reconcile in a single response cycle — as the
requirements repeatedly demand — the backend response must enumerate every
added/updated/deleted ID, not just the ID of the entity the user directly
acted on. Rather than each operation below inventing its own bespoke
response shape, every cascading endpoint in this document returns
`ComponentCollectionDto` (designed once in `core-edit-session-design.md`'s
[Response Reconciliation](../design/core-edit-session-design.md#response-reconciliation--component-collections)
section) and is merged via that document's single
`applyComponentCollection` reconciler — no operation here hand-writes its
own merge. These are net-new requirements on endpoints that do not yet
exist, flagged for the backend team.

## Subgraph Provenance

REQ-016a/b/c and REQ-048 define three different delete behaviors for a
subgraph depending on how it reached the canvas. This is tracked as a field
directly on the subgraph node object in `GraphDataSlice`, set once at
creation/load time and never mutated after — the same pattern already used
for the optional `diffState`/`diffChangedFields` fields on existing node
types:

```typescript
type SubgraphProvenance = 'pre-loaded' | 'palette-placed' | 'newly-created';

interface Subgraph {
  // ...existing fields...
  provenance: SubgraphProvenance;
  subgraphDefId: number; // definition ID, distinct from this node's instance subgraphId — see REQ-015 below
}
```

| Provenance | Set when | Delete behavior |
| --- | --- | --- |
| `pre-loaded` | Present in the use case when edit mode was entered | Stages a backend delete call |
| `palette-placed` | Dropped from the subgraph palette this session (REQ-012) | UI-cache-only removal, no backend call |
| `newly-created` | Created via drag-to-empty-space (REQ-006) or paste (see `canvas-ui-mechanics-design.md`) | Stages a backend delete call |

**`pre-loaded` and `newly-created` call the same `deleteSubgraph` action —
there is no separate "cascade delete" endpoint.** Cascading to the
subgraph's containers, modules, and links is the backend's responsibility
in both cases; the frontend issues one delete call for the subgraph ID and
does not compute or submit the cascade itself:

```typescript
deleteSubgraph(subgraphId: string): Promise<ComponentCollectionDto>
// collection.deleted = {subgraphIds: [subgraphId], containerIds, moduleIds, linkIds}
```

The response shape is the same `ComponentCollectionDto` every cascading
delete in this document uses (`core-edit-session-design.md`) — the canvas
needs the full set of removed IDs to clear containers, modules, and links
from `GraphDataSlice` in one pass via `applyComponentCollection`, regardless
of which provenance triggered the call. Only `palette-placed` skips the
backend entirely, per REQ-016a.

The Delete context-menu/Delete-key handler (`canvas-ui-mechanics-design.md`)
branches purely on the `provenance` field — no separate tracking map is
needed, and no branching on the API called, since `pre-loaded` and
`newly-created` both call `deleteSubgraph`.

---

## Module Operations

**REQ-004–005 — add to existing container.** Drag from the module palette
onto a container that belongs to an existing subgraph → immediate backend
call:

```typescript
addModuleInstance(containerId: string, moduleDefId: string, position: XY): Promise<ComponentCollectionDto>
// collection.added = {modules: [module]}
```

Canvas updates only after confirmation — the response is merged via
`applyComponentCollection` (`core-edit-session-design.md`). The change
propagates to every use case containing that subgraph on Apply Changes.

**REQ-006 — add to empty canvas space.** Atomic: one backend call creates
subgraph → container → module instance together, not three sequential
calls:

```typescript
createSubgraphWithModule(moduleDefId: string, position: XY): Promise<ComponentCollectionDto>
// collection.added = {subgraphs: [subgraph], containers: [container], modules: [module]}
```

All three entities merge into `GraphDataSlice` together on success via
`applyComponentCollection`; the caller stamps the new subgraph's
`provenance: 'newly-created'` on the response before passing it to the
reconciler (`core-edit-session-design.md`'s caller-owned-fields note). On
failure: toast, nothing added — atomicity means no partial state is
possible.

**REQ-007 — add inside a subgraph, outside any container.** Same
atomicity, one level shallower — the subgraph already exists, so there's no
provenance change:

```typescript
createContainerWithModule(subgraphId: string, moduleDefId: string, position: XY): Promise<ComponentCollectionDto>
// collection.added = {containers: [container], modules: [module]}
```

**REQ-008–009 — delete module.** Context menu or Delete key:

```typescript
deleteModuleInstance(moduleId: string): Promise<ComponentCollectionDto>
// collection.deleted = {moduleIds: [moduleId], linkIds: deletedLinkIds}
```

The backend also deletes every link connected to the module; the UI removes
those links from canvas in the same response cycle via
`applyComponentCollection`.

**REQ-010 — rename module.** Properties panel field:

```typescript
renameModuleInstance(moduleId: string, newName: string): Promise<void>
```

Confirmed by the backend before the canvas reflects the change.

**REQ-011 — invalid drop: module onto module, proxy node, or subsystem.**
The *rule* is stated here: dropping a module-palette item onto an existing
module node, a subgraph proxy node, or a subsystem node is always rejected
— modules are not containers, a proxy node represents a collapsed
subgraph, and no auto-create chain into a subsystem is specified (unlike
REQ-006/007's subgraph/container auto-create). The subsystem rejection
applies in both raw and subsystem mode, since only the subgraph palette is
disabled by REQ-047 — the module palette stays enabled either way. The
drag-and-drop *validation mechanism* that enforces this — shared with
REQ-019's subgraph-drop rules — is designed once in
`canvas-ui-mechanics-design.md` and cross-referenced here rather than
re-specified.

---

## Container Operations

**REQ-020 — delete container.** Context menu or Delete key, cascades to
every module instance inside it and their links:

```typescript
deleteContainer(containerId: string): Promise<ComponentCollectionDto>
// collection.deleted = {containerIds: [containerId], moduleIds, linkIds}
```

**REQ-021 — no rename.** Containers have no name field. The properties
panel (`canvas-ui-mechanics-design.md`) renders no name field for container
nodes — nothing further to design here.

**REQ-022 — implicit creation only.** Containers are created only as a
side effect of REQ-006/007's atomic add actions above. There is no
standalone "add container" action.

**REQ-023 — edit container ID.** Properties panel field:

```typescript
updateContainerId(containerId: string, newId: string): Promise<void>
```

**This edits the container's primary `containerId`, not a separate cosmetic
field** — `Container` (`graph-data-slice.ts`) has only one ID field, unlike
`ModuleInstance`'s distinction elsewhere in the app between a primary key
and a display label. Because `ModuleInstance.containerId` references this
value by ID, this call can re-key more than one entity (the container
itself, plus every module instance that referenced its old ID) — per
`core-edit-session-design.md`'s dividing line, that makes it a
`ComponentCollectionDto` case, not a single-field response. **The container
itself goes in `deleted`+`added` (old ID removed, new-ID entity inserted),
not `updated`** — `applyComponentCollection`'s upsert-by-ID would otherwise
leave a stale orphaned entry at the old `containerId` behind, since a
rename changes the very key the upsert keys on; this is the one exception
to "added/updated are both a plain upsert" called out in
`core-edit-session-design.md`. The referencing modules *do* go in
`updated`, since their own ID is unchanged — only their `containerId`
field value changes:

```typescript
updateContainerId(containerId: string, newId: string): Promise<ComponentCollectionDto>
// collection.deleted = {containerIds: [containerId]}     — old key removed
// collection.added   = {containers: [container w/ newId]} — new key inserted
// collection.updated = {modules: [every module re-keyed to containerId: newId]}
```

Confirmed by the backend before the canvas reflects the update via
`applyComponentCollection`; error toast on failure.

---

## Subgraph Operations

**REQ-012 — placement from palette.** On drop, fetch the full subgraph
contents (containers, modules, internal links) from the backend and render
them on canvas. This is session-local, **not staged**:

```typescript
getSubgraphContents(subgraphDefId: string): Promise<{
  subgraph: SubgraphDto; // includes supportedKvs — see kv-key-configuration-design.md
  containers: Container[];
  modules: ModuleInstance[];
  links: Connection[];
}>
```

This is a read-only fetch — no `changeId`, no Apply-time staging. A failed
fetch shows a toast and places nothing. The new subgraph node gets
`provenance: 'palette-placed'`, and its `subgraphDefId` field (added to the
`Subgraph` interface above) is populated from this DTO's `subgraph` — this
is what REQ-015's duplicate-placement guard, below, compares against.

**REQ-013 — pair-link auto-render.** Immediately after a successful
placement, the tool calls the subgraph-pairs API to retrieve all known
linked pairs, and for each pair where one side is the newly-dropped subgraph
and the other is already on canvas, renders that connection:

```typescript
interface SubgraphPairDto {
  id: string; // link ID — same ID used as the key in excludedLinkIds/pairLinksById
  sourceSubgraphId: string;
  targetSubgraphId: string;
  fromModuleId: string;
  fromPortId: string;
  toModuleId: string;
  toPortId: string;
}

getSubgraphPairs(subgraphDefId: string): Promise<SubgraphPairDto[]>
```

A `getSubgraphPairs` failure does **not** roll back the placement — the
subgraph fetched via `getSubgraphContents` above still lands on canvas; a
toast reports the pairs-fetch failure and the subgraph simply renders with
no pair connections. The two calls are independent failure domains.

These connections already exist in the backend and require no staging —
"kept in UI cache only," per the requirement. They form a **third edge
category**, distinct from both normal staged links and proxy-derived links,
marked with a field on the edge object parallel to `provenance` on nodes:

```typescript
interface Connection {
  // ...existing fields...
  origin?: 'pair-api'; // absent = a normal staged link
}
```

The `getSubgraphPairs` response is cached on `EditSessionSlice`, keyed by
link ID, so the reversal detection in `link-and-port-design.md` can look up
a pair-link's subgraph endpoints without re-fetching:

```typescript
interface EditSessionSlice {
  // ...
  pairLinksById: Map<string, SubgraphPairDto>;
}
```

**REQ-014 — Exclude Link.** Excluding a pair-rendered connection **removes
it from the canvas** (not merely a visual change) — chosen over keeping it
visible with a distinct style, because REQ-014 only guarantees the link
survives in the backend, not that it stays rendered. Exclusion is tracked
on `EditSessionSlice` (a cross-cutting session concern feeding directly into
`applyChanges()`'s payload, per `core-edit-session-design.md`), not as a
property of the edge object itself:

```typescript
interface EditSessionSlice {
  // ...
  excludedLinkIds: string[];
  excludeLink: (linkId: string) => void; // removes from canvas, no backend call
}
```

**Reversing an exclusion has no dedicated "un-exclude" UI.** The user
reverses it by manually re-drawing the connection via the normal right-click
port-to-port flow (REQ-024). That flow's connection-completion handler
checks whether the manually-drawn connection matches an excluded pair-link
— same source/target subgraph pair, looked up via `pairLinksById` above —
and if so, simply clears the exclusion flag and re-renders the existing
connection, **with no backend call**, since REQ-013 already established the
link exists server-side. It must not be treated as new-link creation, which
would incorrectly call the link-creation endpoint for a link the backend
already has. **The concrete detection logic (the `handleEdgeConnected`
branch and `isSameSubgraphPair` comparison) is designed in
`link-and-port-design.md`'s Connection Creation Flow section** — this
document owns the `excludedLinkIds`/`pairLinksById` state it reads.

```mermaid
sequenceDiagram
  participant U as User
  participant ES as EditSessionSlice
  participant V as Visualizer (right-click connect)

  U->>ES: Exclude Link (on a pair-rendered connection)
  ES->>ES: excludedLinkIds.push(linkId); edge removed from canvas
  Note over U: link stays in backend, unaffected until Apply
  U->>V: manually redraws same source/target port pair
  V->>ES: connection-completion handler checks excludedLinkIds + pairs data
  alt matches an excluded pair-link
    ES->>ES: excludedLinkIds.remove(linkId); edge re-rendered — no backend call
  else genuinely new connection
    Note over V: proceeds as ordinary link creation (link-and-port-design.md)
  end
```

**REQ-015 — duplicate-placement guard.** The subgraph palette
(`canvas-ui-mechanics-design.md` owns rendering) needs to know which
subgraph *definitions* are currently placed, compared by definition ID, not
node ID — a derived read from `GraphDataSlice`:

```typescript
const placedSubgraphDefIds = new Set(
  Object.values(graphData.subgraphs).map((sg) => sg.subgraphDefId),
);
```

**REQ-017 — rename subgraph.** Properties panel field, same shape as
module rename (REQ-010):

```typescript
renameSubgraph(subgraphId: string, newName: string): Promise<void>
```

Confirmed by the backend before the canvas reflects the change.

**REQ-018 — implicit creation only.** Subgraphs are created only via
REQ-006. Already satisfied by the operations above; no new design.

**REQ-019 — invalid drop, tightened.** The original requirement text
("dropping a subgraph inside an existing subgraph") left ambiguous whether
it covered the subgraph's contents and proxy nodes. It has been amended in
the requirements doc to explicitly cover: dropping a subgraph onto an
existing subgraph, onto that subgraph's contents (containers or modules),
or onto a subgraph proxy node. Dropping a subgraph onto a subsystem is
**not** a drop-target-validation case at all — it's prevented entirely by
REQ-047 disabling the subgraph palette while the canvas is in subsystem
mode (`canvas-ui-mechanics-design.md`), since a disabled palette item has no
drag payload to validate in the first place. The DnD *mechanism* enforcing
REQ-019 is designed once in `canvas-ui-mechanics-design.md`, shared with
REQ-011.

---

## Subsystem Operations

**REQ-031a — create/move into subsystem.** Right-click a subgraph or
subsystem → "Move to Subsystem" → prompt for an existing subsystem or a new
one. One action covers both cases — the backend either creates-and-moves in
one call, or just reparents:

```typescript
moveToSubsystem(
  nodeId: string,
  target: {subsystemId: string} | {createNew: true; name: string},
): Promise<ComponentCollectionDto>
// createNew path: collection.added = {subsystems: [subsystem]}, plus the moved node in `updated`
// existing-subsystemId path: the moved node appears in `updated` only
```

Confirmed by the backend before the canvas reflects the change, merged via
`applyComponentCollection`. On the `createNew` path, the new subsystem node
is positioned at the moved node's own prior position (the subsystem
visually replaces it on canvas). On the existing-`subsystemId` path, no new
node is created — only the moved node's `parentId`/containment changes,
which is why it comes back in `updated` rather than `added` on that path.

**REQ-031c — rename subsystem.** Properties panel field, same shape as
subgraph rename (REQ-017):

```typescript
renameSubsystem(subsystemId: string, newName: string): Promise<void>
```

Confirmed by the backend before the canvas reflects the change.

**REQ-031b — delete subsystem.** Cascades to all contents:

```typescript
deleteSubsystem(subsystemId: string): Promise<ComponentCollectionDto>
// collection.deleted = {subsystemIds: [subsystemId], subgraphIds, containerIds, moduleIds, linkIds}
```

**REQ-031c — rename.** Standard properties-panel rename, confirmed before
the canvas reflects it — see `renameSubsystem` above.

**REQ-031d — update contents: not a new operation.** This requirement
describes the *net effect* of REQ-031a (move in) and standard deletion
(move out) — it does not introduce a distinct "update subsystem contents"
action. Stated explicitly here to avoid a redundant operation being built.

**REQ-032 — expand.** Deletes the subsystem container and promotes all its
contents one hierarchy level up. The backend deletes connections to the
subsystem's external ports as part of the operation and must return the
deleted-connection list so the UI reconciles in one shot, following the
same cascading-response pattern as delete operations above:

```typescript
expandSubsystem(subsystemId: string): Promise<ComponentCollectionDto>
// promoted nodes come back in `updated` (reparented, not deleted);
// collection.deleted = {linkIds: deletedConnectionIds} for the severed external-port connections
```

Each promoted node's containment (`parentId`/`subsystemId`, whichever field
its node type uses) is set to the **expanded subsystem's own former
parent** — already known client-side before the call, since the subsystem
node being expanded already carries that value. The backend response does
not need to repeat it; the client stamps this onto each promoted node
(the same caller-owned-fields pattern as `provenance`,
`core-edit-session-design.md`) before passing the collection to
`applyComponentCollection`.

Standard failure handling: toast, no change applied.

---

## Open Items Inherited

- **Excluded links API**: DTO shape for passing `excludedLinkIds` to the
  routing algorithm on Apply Changes (REQ-014) — TBD with the backend team.
  `applyChanges()` (`core-edit-session-design.md`) is the call site that
  depends on this contract existing.
- **Subsystem CRUD backend API**: endpoint shapes for `moveToSubsystem`,
  `deleteSubsystem`, rename, and `expandSubsystem` — all TBD with the
  backend team, per the requirements doc's own open items.
- **API contracts** for all module/container/subgraph mutation endpoints
  above (`addModuleInstance`, `createSubgraphWithModule`,
  `createContainerWithModule`, `deleteModuleInstance`, `deleteContainer`,
  `getSubgraphContents`, `getSubgraphPairs`) — none exist today; this
  document specifies required response shapes but not final paths/DTOs.
