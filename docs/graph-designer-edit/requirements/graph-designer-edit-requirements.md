# Graph Designer — Edit Feature: Requirements

## 1. Canvas modes

**REQ-001** The canvas operates in two modes: **View** and **Edit**. Edit mode
is entered via a **"Start Graph Modification"** button. Edit mode is exited via
the **"Apply Changes"** button (commits staged edits) or the **"Discard"**
button (abandons the session).

**REQ-001a** In View mode, the canvas renders use cases from the last
selection. If no prior selection is available, the first use case in the list
is shown. The Graph Visualizer and Log View panels are shown alongside the
canvas.

**REQ-002** In View mode, the canvas renders already-created use cases. The
only available operation is double-clicking a module, which opens a new tab for
cal/tag data tuning. No structural editing operations are available in View
mode.

**REQ-002a** In View mode, clicking a module, subgraph, container, or
data/control link opens the properties panel for that component in a
read-only view. This is separate from the double-click behavior in REQ-002,
which opens a dedicated cal/tag tuning tab — the two interactions coexist.

**REQ-003** In Edit mode, the canvas exposes: module palette, subgraph palette,
context menus, inline connection creation, properties panel, Key Configurator
panel, Apply Changes button, Discard button.

---

## 2. Module operations

**REQ-004** User can add a module instance by dragging from the module palette
onto any container. Multiple instances of the same module definition are
allowed within a container.

**REQ-005** When a module is added to a container that belongs to an existing
subgraph, the backend is called immediately and the canvas is updated only
after the backend confirms the change. If the call fails, an error toast is
shown and no change is applied to the canvas. The change propagates to all
use cases that contain that subgraph only when Apply Changes is run.

**REQ-006** User can add a module by dragging from the module palette onto
**empty canvas space**. This atomically auto-creates a new subgraph → new
container → module instance via a single backend call. The canvas is updated
only after the backend confirms. If the call fails, an error toast is shown
and no change is applied to the canvas.

**REQ-007** User can add a module by dragging it inside a subgraph but
**outside any existing container**. The tool auto-creates a new container
within that subgraph and places the module inside it. The canvas is updated
only after the backend confirms. If the call fails, an error toast is shown
and no change is applied to the canvas.

**REQ-008** User can select and delete a module instance via the context
menu or the **Delete key**. The canvas is updated only after the backend
confirms the deletion. On failure, an error toast is shown.

**REQ-009** When a module deletion is confirmed by the backend, the backend
also deletes all links connected to that module. The UI must remove those links
from the canvas in the same response cycle to stay in sync.

**REQ-010** User can rename a module instance via the properties panel. The
rename is confirmed by the backend before the canvas reflects the change.

**REQ-011** Dropping a module onto another module, onto a subgraph proxy
node, or onto a subsystem node is not permitted. The tool must reject such
a drop at the drag-and-drop level and provide a visual indicator that the
target is invalid. (Dropping a module onto a subsystem while the canvas is
in subsystem mode is separately covered by REQ-047's palette-disable, but
the rejection here also applies in raw mode, where the subsystem node is
still on canvas and the module palette is not disabled.)

---

## 3. Subgraph operations

**REQ-012** User can place an existing subgraph onto the canvas by dragging
from the subgraph palette. On drop, the full subgraph contents (all containers,
modules, and internal links) are fetched from the backend and rendered on
canvas. This placement is **session-local** — it is not staged to the backend.

**REQ-013** When a subgraph is dropped onto the canvas, the tool calls the
backend subgraph-pairs API to retrieve all known linked subgraph pairs. For
each returned pair where one subgraph is the newly dropped one and the other is
already on the canvas, the tool renders the corresponding connection on canvas
from the API response — these connections already exist in the backend and
require no staging. They are kept in UI cache only. The user does not need to
draw these connections manually.

**REQ-014** After a subgraph is placed and its pair connections are rendered per
REQ-013, the user may choose to exclude one or more of those connections from
the routing algorithm. The tool provides an **"Exclude Link"** action on each
auto-rendered connection. Excluding a connection does not delete it from the
backend — the connection remains in the graph. Excluded links are tracked per
session and passed to the backend routing algorithm on Apply Changes so the
routing engine does not use them when generating use cases.

**REQ-014a** Once a connection is excluded per REQ-014, it is removed from the
visual canvas. It remains tracked in session state (per REQ-014) and is
included in the Apply Changes payload — only its on-canvas rendering is
affected.

**REQ-015** A subgraph already on the canvas is shown as **disabled** in the
subgraph palette with a tooltip "Already present on the canvas". Duplicate placement
is blocked. Palette ordering is unaffected — disabled entries are shown
greyed-out in their existing list position rather than sorted to the bottom.

**REQ-016a** Removing a **palette-placed** subgraph (one placed in the current
session via the subgraph palette) from the canvas is a UI cache delete only —
no backend call is made, since the placement was never staged to the backend.

**REQ-016b** Removing a **pre-loaded** subgraph (one that was part of the
selected use case when edit mode was entered) from the canvas stages a delete
to the backend immediately, via the same delete call used for REQ-016c. The
backend cascades the deletion to all of the subgraph's containers, modules,
and links atomically. The canvas is updated only after the backend
confirms. On Apply Changes, the routing algorithm accounts for this deletion
and impacts all use cases that contained this subgraph.

**REQ-016c** Deleting a **newly created subgraph** (created in this session,
e.g., via drag-to-empty-space) stages the same delete call as REQ-016b. The
backend cascades the deletion to all of the subgraph's containers, modules,
and links atomically — there is no separate cascade-specific endpoint; both
provenances delete identically from the frontend's perspective. This can be
triggered via context menu or the **Delete key**. The canvas is updated only
after the backend confirms the entire deletion. On failure, an error toast is
shown and no change is applied.

**REQ-017** User can rename a subgraph via the properties panel. The rename is
confirmed by the backend before the canvas reflects the change.

**REQ-018** Subgraphs are created implicitly — only via REQ-006 (dragging a
module onto empty canvas space, which auto-creates a new subgraph, container,
and module instance). There is no explicit standalone "add subgraph" action.

**REQ-019** Dropping a subgraph onto an existing subgraph, onto any of that
subgraph's contents (containers or modules), or onto a subgraph proxy node,
is not permitted. The tool must reject such a drop at the drag-and-drop
level and provide a visual indicator that the target is invalid. (Dropping a
subgraph onto a subsystem is separately prevented by REQ-047, since the
subgraph palette is disabled entirely while the canvas is in subsystem
mode.)

---

## 4. Container operations

**REQ-020** User can delete a container via context menu or the **Delete key**.
Deleting a container cascades to delete all module instances within it and all
links connected to those modules. The canvas is updated only after the backend
confirms the entire deletion. On failure, an error toast is shown.

**REQ-021** Containers do not have names. No rename operation is available for
containers.

**REQ-022** Containers are created implicitly — either via REQ-007 (dragging a
module inside a subgraph outside any existing container) or via REQ-006
(dragging a module to empty canvas space). There is no explicit standalone
"add container" action.

**REQ-023** User can edit the container ID from the properties panel. The
change is confirmed by the backend before the canvas reflects the update. On
failure, an error toast is shown.

---

## 5. Link operations (data and control links)

**REQ-024** User can create a data or control link by right-clicking a source
port to start a connection, then right-clicking a destination port to complete
it (see REQ-038 for the port context menu interface). The link is rendered on
canvas only after the backend confirms.

**REQ-025** While a connection is in progress (after right-clicking a source
port), pressing **Escape** cancels the operation and clears the in-progress
visual indicator. No API call is made.

**REQ-026** Links can connect modules across any two subgraphs, and from module
ports to subsystem ports.

**REQ-027** When a user connects a module inside **Subsystem A** to a module
inside **Subsystem B**, the backend automatically creates the full set of
intermediate connections: module→Subsystem A, Subsystem A→Subsystem B, and
Subsystem B→module. The UI must render all connections returned in the backend
response after the operation completes.

**REQ-028** Client-side port validation runs before the API call: port type
compatibility (data-to-data, control-to-control) and `maxConnections` limit are
enforced eagerly.

**REQ-029** Server-side validation is the final arbiter. If the server rejects
a link, no change is applied to the canvas and an error toast is shown.

**REQ-030** User can delete a link via context menu or the **Delete key**. The
link is removed from the canvas only after the backend confirms the deletion.

---

## 6. Subsystem operations

**REQ-031a** User can create a new subsystem or move a subgraph or subsystem
into an existing subsystem by right-clicking a subgraph or subsystem and
selecting **"Move to Subsystem"**. The user is then prompted to select an
existing subsystem or create a new one. The canvas is updated only after the
backend confirms. On failure, an error toast is shown.

**REQ-031b** User can delete a subsystem via context menu or the **Delete key**.
Deleting a subsystem cascades to delete all its contents (subgraphs, modules,
containers, and links). The canvas is updated only after the backend confirms
the deletion. On failure, an error toast is shown.

**REQ-031c** User can rename a subsystem via the properties panel. The rename
is confirmed by the backend before the canvas reflects the change.

**REQ-031d** User can update a subsystem by adding subgraphs or subsystems into
it, or removing subgraphs or subsystems from it. Each change is confirmed by
the backend before the canvas reflects the update.

**REQ-032** User can **expand** a subsystem. Expanding a subsystem deletes the
subsystem container and moves all its components (subgraphs, modules,
containers, and internal links) one hierarchy level up. The backend deletes all
connections to the subsystem's external ports and returns the list of deleted
connections in the API response. The UI must remove those connections from the
canvas in the same response cycle. The canvas is updated only after the backend
confirms the entire expand operation. On failure, an error toast is shown and
no change is applied.

---

## 7. Port operations

**REQ-033** User can increase or decrease the **data port count** on a module
instance from the properties panel. The canvas is updated only after the
backend confirms. Newly added ports become available for connection.

**REQ-034** User can increase or decrease the **control port count** on a
module instance from the properties panel. The canvas is updated only after the
backend confirms. Newly added ports become available for connection.

**REQ-035** When a port count is decreased, the backend determines whether the
decrease is allowed. If rejected, an error toast is shown and no change is
applied.

**REQ-036** User can increase or decrease the **data port count** on a
subsystem from the properties panel. The canvas is updated only after the
backend confirms. Newly added ports become available for connection.

**REQ-037** User can increase or decrease the **control port count** on a
subsystem from the properties panel. The canvas is updated only after the
backend confirms. Newly added ports become available for connection.

**REQ-038** In Edit mode, right-clicking a port shows a context menu with two
options:
- **Start connection**: begins a connection operation from this port.
- **End connection**: completes an in-progress connection at this port. This
  option is shown only when a connection is already in progress.

---

## 8. KV assignment — existing subgraph (palette-placed)

**REQ-039** When an existing subgraph is placed on the canvas, its supported
KVs are loaded from the subgraph DTO returned with the subgraph contents. No
KVs are selected automatically — the user must select the desired KVs
explicitly from the Key Configurator panel.

**REQ-040** The **Key Configurator panel** for a selected existing subgraph
shows a checklist of its supported KVs. User can select or unselect each
entry. Changes are stored in the UI only and are not sent to the backend until
Apply Changes is triggered.

**REQ-041** User can add a custom KV to an existing subgraph — one not present
in the supported list. The addition is stored in the UI only and is not sent to
the backend until Apply Changes is triggered.

---

## 9. KV assignment — newly created subgraph

**REQ-042** A newly created subgraph has no backend-provided supported KV list.
The **Key Configurator panel** shows only a free-form "Add KV" form.

**REQ-043** User can add and remove KVs freely on a newly created subgraph.
Changes are stored in the UI only and are not sent to the backend until Apply
Changes is triggered.

---

## 10. Apply Changes

**REQ-044** An "Apply Changes" button is visible in edit mode and disabled
while an Apply is in-flight, or while any other staged operation
(module/subgraph/link/etc. add, delete, rename, port-count change) is still
awaiting backend confirmation — see `core-edit-session-design.md`'s
`isMutating` lock (REQ-065).

**REQ-045** Apply sends the following to the backend routing endpoint: the
selected use cases, any excluded data/control links from the current session
(REQ-014), the selected KV assignments for all subgraphs on canvas, and the
assigned Keys for all subsystems on canvas (REQ-071).

**REQ-046** On Apply success, the backend returns a **modification summary**.
The UI displays this summary to the user. On failure, the failure details are
shown within the summary view rather than as a toast notification.

---

## 11. Palettes

**REQ-047** Dragging and dropping subgraphs from the subgraph palette is
**not permitted when the canvas is in subsystem mode**. Palette items are shown
as disabled in subsystem mode with a tooltip explaining the restriction.

> **Dependency note:** "Subsystem mode" vs. "raw mode" is a pre-existing
> display toggle (subsystem mode shows subsystems for the selected use
> cases; raw mode hides all subsystems even if present) that applies to both
> View and Edit mode — it is not introduced by this feature. As of this
> writing, the toggle is not yet implemented in code (no consuming
> state/UI/canvas-filtering logic exists; the closest analogs are two
> unwired preference fields, `visualization.simplifySubsystems` and
> `usecases.mode`). Building that toggle is **out of scope** for Graph
> Designer Edit — this feature only consumes whatever state it exposes once
> built elsewhere.

---

## 12. Context menus

**REQ-048** In Edit mode, right-clicking a node shows a context menu with a
**Delete** option. The tool determines the appropriate behavior based on the
node type:
- **Palette-placed subgraph**: removes from the UI cache only; no backend call.
- **Pre-loaded subgraph**: stages a delete to the backend.
- **Newly created subgraph**: stages a delete and cascades to remove all
  containers, modules, and links.
- **Module or container**: stages a delete to the backend.

**REQ-049** In Edit mode, right-clicking an edge shows a context menu with a
**Delete** option.

**REQ-050** The **Delete key** triggers the same delete action as the context
menu Delete option for any currently selected node or edge.

---

## 13. Properties panel

**REQ-051** Selecting a node opens a properties panel showing editable fields
for that node type. For modules and subsystems, the panel includes port count
controls (data and control, increase/decrease) per REQ-033 to REQ-037. Name
fields are shown where renaming is supported.

---

## 14. Key Configurator panel

**REQ-052** The Key Configurator panel content changes based on the selected
node:
- **Subgraph selected**: shows the KV assignment interface — a checklist of
  supported KVs for palette-placed subgraphs (REQ-040) or a free-form add form
  for newly created subgraphs (REQ-042).
- **Subsystem selected**: shows the keys assignment interface per REQ-071.
- **Module selected**: shows the CKV/TKV configuration interface per REQ-053.

**REQ-053** The Key Configurator panel for a selected module shows the module's
CKV/TKV configuration. A CKV (Calibration Key Value) is a named key-value pair
that uniquely identifies a calibration data set for a module; a module can have
multiple CKV/TKV entries. The user can add, edit, and remove CKV/TKV entries
from this panel. Each change is staged to the backend immediately and the panel
reflects the change only after the backend confirms.

**REQ-071** User can assign Keys to a subsystem from the Key Configurator
panel. This is a keys assignment — distinct from KV assignment used for
subgraphs. Assignments are stored in the UI only and are not sent to the
backend until Apply Changes is triggered.

---

## 15. MDF (Multi DSP Framework) use cases

**REQ-054** KV assignment is not available for MDF subgraphs. The Key
Configurator panel must not show KV options when the selected subgraph is of
MDF type.

**REQ-055** When a user adds a connection between modules running on two
different DSPs, the backend inserts additional bridge modules and connections to
represent the cross-DSP path. The UI must support two display modes for this,
controlled by user preference:
- **Expanded view**: shows the backend-generated bridge modules and connections
  explicitly on the canvas.
- **Virtual connection view**: shows a single logical connection line hiding
  the intermediate complexity.

**REQ-072** User can right-click any module and select **"Offload to other
DSP"** from the context menu, then choose the target DSP from a list of
available DSPs. The tool calls a new backend API for this operation:
- **First offload of this module**: the backend inserts a new IPC TX module
  (before the offloaded module, on its original DSP) and a new IPC RX module
  (after it, on the target DSP), reassigns the offloaded module's container
  to one associated with the target DSP, and reroutes any existing links
  connected to the module through the new IPC TX/RX pair.
- **Re-offloading a module that already has an IPC TX/RX pair from a prior
  offload** (including offloading it back to its original DSP): the backend
  updates the existing IPC TX/RX pair in place to reflect the new target
  DSP, rather than inserting an additional pair or deleting and recreating
  one. There is no dedicated "un-offload" action — offloading back to the
  original DSP is the same action, targeting that DSP.
- In both cases, the backend returns a component collection describing
  everything added/changed (new or updated IPC modules, new/rerouted links,
  new container assignment), and the UI updates in the same response cycle.
- This follows the same backend-driven intermediate-insertion pattern as
  REQ-027/055. The IPC TX/RX modules are subject to REQ-055's
  Expanded/Virtual display-mode preference, the same as other cross-DSP
  bridge modules.
- The canvas is updated only after the backend confirms. On failure, an
  error toast is shown and no change is applied.

---

## 16. Subgraph proxy node operations

**REQ-056** Connections cannot be created to or from a subgraph proxy node.
During a connection operation, proxy node ports must be shown as invalid drop
targets. This restriction exists because the proxy node represents a collapsed
subgraph and the target module within it is ambiguous until expanded.

**REQ-057** User can rename a subgraph proxy node via the properties panel.
The rename is confirmed by the backend before the canvas reflects the change.

---

## 17. Positioning

**REQ-058** When a user drags and drops any component (module, subgraph) onto
the canvas, it must be rendered at the exact drop coordinates (x, y).
Auto-layout must not reposition a newly placed component away from the drop
point.

**REQ-059** Users can drag any node (module, container, subgraph) to reposition
it on the canvas. This is available in **both View and Edit modes**. Position
changes are applied to the canvas immediately but are **not staged to the
backend as part of the edit workflow** — they are persisted separately as
layout overrides (persistence mechanism TBD with backend team).

---

## 18. Edit mode lifecycle

**REQ-060** While in edit mode, the tool must block the user from opening the
**Discovery Wizard** or the **Diff/Merge** view. Both can modify the graph
structure independently of the edit session, and the conflict resolution between
them and staged edits is undefined. A tooltip or modal should explain why they
are unavailable.

**REQ-061** The user can click the **Discard** button at any time during the
edit session. Changes made during the session are staged to the backend but not
yet committed. A confirmation prompt is shown before discarding. On
confirmation, a discard request is sent to the backend, which atomically
clears all staged changes; the discard response itself carries no graph
payload. The tool returns to View mode, and the View-mode session fetches the
components for the currently selected use cases fresh from the backend and
renders them. If the user closes the project the same discard flow is
triggered.

**REQ-062** The **"Start Graph Modification"** button is always visible in View
mode. It is disabled with an explanatory tooltip when the Discovery Wizard or
Diff/Merge view is active.

---

## 19. Canvas interaction

**REQ-063** Users can **multi-select** nodes by Shift+clicking or by
rubber-band drag-select on the canvas. Multi-select is available in **both View
and Edit modes**. In Edit mode, a batch Delete operation applies to all selected
nodes and edges simultaneously. Cascades apply per node type (see REQ-048) —
if a parent and child are both selected, the child delete is handled as part of
the parent cascade and is not issued as a separate operation.

**REQ-069** User can copy and paste one or more components at the same
hierarchy level. When multiple components are selected, all connections between
the selected components are automatically included in the paste. Pasted
components are placed at the current canvas viewport center or cursor position.

**REQ-070** User can copy components from one hierarchy level (e.g., inside a
subsystem) and paste them at a different level (e.g., outside the subsystem or
into a different subsystem). Connections between the copied components are
replicated in the target context where valid. Connections to components outside
the copied selection are not carried over.

> **Copyable node types (clarified):** REQ-069/070 apply to modules,
> containers, and **subgraphs**. Pasting a subgraph creates a brand-new
> backend subgraph populated with the copied contents (containers, modules,
> internal links) — it does not reference or alias the original subgraph.
> The pasted subgraph has the same provenance as any other session-created
> subgraph (see REQ-006/REQ-018). Subsystems are not a copyable unit — they
> only appear in these requirements as the *context* pasted into or out of.

---

## 20. Visual feedback

**REQ-064** Port coloring reflects connection visibility based on the currently
selected use cases:
- **Black**: all connections to this port belong to selected use cases and are
  present on the canvas.
- **Grey**: some connections to this port are on the canvas (their use cases
  are selected) and some are not (their use cases are not selected).
- **White**: this port has no connections.

**REQ-065** All operations that require a backend call display a loading spinner
on the affected component until the backend response is received. While a
spinner is active, the component is not interactive.

---

## 21. Enhancements

**REQ-066** The backend returns a `changeId` with each successful staged edit
response.

**REQ-067** *(Out of scope for the current design pass — deferred to a
future enhancement once its own requirements are defined.)* The frontend
maintains a `changeId` stack and exposes undo/redo via a change history
panel in edit mode.

> **Open design problem:** Session-local palette subgraph placements have no
> backend `changeId`. Including them in the undo/redo stack requires either a
> client-side undo layer or staging palette drops to the backend on drop. This
> must be resolved before the undo/redo milestone is planned.

**REQ-068** *(Out of scope for the current design pass — deferred to a
future enhancement, same treatment as REQ-067.)* Context menus on nodes and
edges can be replaced with inline **quick actions** — icon buttons that
appear on hover or selection — to reduce the number of right-click
interactions required for common operations.

---

## Open items (TBD with backend team)

- **API contracts still unconfirmed**: module/container/subgraph/subsystem
  add/delete/rename/move/expand (Section 2–4, 6), port count changes
  (REQ-033–037), CKV/TKV staging (REQ-053), DSP offload (REQ-072), and
  `SubgraphPairDto`'s field shape (REQ-013 — the endpoint path is
  confirmed, but the DTO is currently an empty placeholder in the API
  spec). See each design doc's own "Open Items Inherited" for detail.
  **Resolved, no longer open**: subgraph palette placement content fetch
  (REQ-012, `getSubgraphContents` → `GET /subgraphs/{id}/components`),
  subgraph-pairs API path (REQ-013 → `GET /subgraphs/{id}/subgraph-pairs`),
  Apply Changes / routing (REQ-044–046 → `POST /projects/{id}/usecases`,
  `CreateUsecasesRequestDto`/`CreateUsecasesResponseDto`), session discard
  (REQ-061 → `POST /projects/{id}/discard-changes`,
  `DiscardChangesRequestDto`/`DiscardChangesResponseDto`), and excluded
  links (REQ-014 → `excludedDataLinkSystemIds`/`excludedControlLinkSystemIds`
  on the Apply Changes payload) — all confirmed in
  `core-edit-session-design.md`. Undo/redo restore remains out of scope
  per REQ-067 and is not designed here regardless of contract status.
- **Subsystem Keys assignment (REQ-071) has no backend contract at all** —
  not merely an unconfirmed path/DTO on an otherwise-real endpoint; no
  endpoint in the current API accepts this payload. See
  `kv-key-configuration-design.md`/`core-edit-session-design.md`'s Open
  Items.
- **Position persistence**: mechanism for persisting layout overrides (REQ-059)
  outside the staged-edit workflow.
- **Batch/multi-entity creation for paste**: REQ-069/070 (copy/paste) can
  create many entities in one user action — multiple modules/containers plus
  their inter-connections, or a full subgraph snapshot (containers, modules,
  internal links) when a subgraph is pasted. A batch-create endpoint (or an
  equivalent atomic multi-entity contract, mirroring REQ-006's atomic
  subgraph+container+module creation) is needed so a paste either fully
  succeeds or fully fails, rather than partially applying via sequential
  single-entity calls.
