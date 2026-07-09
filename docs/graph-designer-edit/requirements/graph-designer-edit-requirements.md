# Graph Designer — Edit Feature: Requirements

## 1. Canvas modes

**REQ-001** The canvas operates in two modes: **View** and **Edit**. A toggle switches between them.

**REQ-002** In View mode, the canvas renders already-created use cases. No editing operations are available.

**REQ-003** In Edit mode, the canvas exposes: module palette, subgraph palette, context menus, inline connection creation, properties panel, Key Configurator panel, Apply Changes button, and undo/redo (future).

---

## 2. Module operations

**REQ-004** User can add a module instance by dragging from the module palette onto any container. Multiple instances of the same module definition are allowed.

**REQ-005** When a module is added to a container that belongs to an existing subgraph, the change is staged to the backend immediately and propagates to all use cases that contain that subgraph when Apply Changes is run.

**REQ-006** User can add a module by dragging from the module palette onto **empty canvas space**. This atomically auto-creates a new subgraph → new container → module instance and stages all three to the backend. If the backend call fails, all three are rolled back together.

**REQ-007** User can add a module by dragging it inside a subgraph but **outside any existing container**. The tool auto-creates a new container within that subgraph and places the module inside it.

**REQ-008** User can delete a module instance via the context menu or the **Delete key**. The deletion is staged to the backend immediately.

**REQ-054** When a module deletion is confirmed by the backend, the backend also deletes all links connected to that module. The UI must remove those links from the canvas in the same response cycle to stay in sync.

**REQ-009** User can rename a module instance via the properties panel. The rename is staged to the backend immediately.

---

## 3. Subgraph operations

**REQ-010** User can place an existing subgraph onto the canvas by dragging from the subgraph palette. On drop, the full subgraph contents (all containers, modules, and internal links) are fetched from the backend and rendered on canvas. This placement is **session-local** — it is not staged to the backend until Apply Changes is triggered.

**REQ-068** When a subgraph is dropped onto the canvas, the tool calls the backend subgraph-pairs API to retrieve all known linked subgraph pairs. For each returned pair where one subgraph is the newly dropped one and the other is already on the canvas, the corresponding connection is automatically rendered and staged to the backend immediately. The user does not need to draw these connections manually.

**REQ-011** A subgraph already on the canvas is shown as **disabled** in the subgraph palette with a tooltip "Already in this use case". Duplicate placement is blocked.

**REQ-012** Removing a subgraph from canvas behaves differently depending on how it arrived:
- **Palette-placed in this session**: removal is a UI cache delete only — no backend call, since the placement was never staged.
- **Pre-loaded from selected use cases**: a staged delete is sent to the backend immediately. On Apply Changes, the routing algorithm runs accounting for this deletion and impacts existing use cases that contained this subgraph.

**REQ-013** Deleting a **newly created subgraph** (created from scratch in this session, e.g. via drag-to-empty-space) stages a delete to the backend and cascades to remove all its containers, modules, and associated links atomically. This can be triggered via context menu or the **Delete key**. On failure the rollback is atomic.

**REQ-014** User can rename a subgraph via the properties panel. The rename is staged to the backend immediately.

---

## 4. Container operations

**REQ-047** User can delete a container via context menu or the **Delete key**. Deleting a container cascades to delete all module instances within it and all links connected to those modules. The entire operation is staged as a single atomic unit and rolled back together on failure.

**REQ-048** Containers do not have names. No rename operation is available for containers.

**REQ-055** Containers are created implicitly — either via REQ-007 (dragging a module inside a subgraph outside any existing container) or via REQ-006 (dragging a module to empty canvas space). There is no explicit standalone "add container" action.

---

## 5. Link operations (data and control links)

**REQ-016** User can create a data or control link by **right-clicking a source port** to start a connection, then **right-clicking a destination port** to complete it. The link is staged to the backend immediately.

**REQ-061** While a connection is in progress (after right-clicking a source port), pressing **Escape** cancels the operation and clears the in-progress visual indicator. No API call is made.

**REQ-017** Links can connect modules across any two subgraphs, and from module ports to subsystem ports.

**REQ-066** When a user connects a module inside **Subsystem A** to a module inside **Subsystem B**, the backend automatically creates the full set of intermediate connections: module→Subsystem A, Subsystem A→Subsystem B, and Subsystem B→module. The UI must render all connections returned in the backend response after the operation completes.

**REQ-018** Client-side port validation runs before the API call: port type compatibility (data-to-data, control-to-control) and `maxConnections` limit are enforced eagerly.

**REQ-019** Server-side validation is the final arbiter. If the server rejects a link, the optimistic update is rolled back and an error toast is shown.

**REQ-020** User can delete a link via context menu or the **Delete key**. The deletion is staged to the backend immediately.

---

## 6. Subsystem operations

**REQ-021** Full CRUD for subsystems is supported: add, delete, rename, and **update** (adding subgraphs into a subsystem and removing subgraphs from a subsystem). All operations are staged to the backend immediately.

---

## 7. Port operations

**REQ-049** User can increase or decrease the **data port count** on a module instance from the properties panel. Each change is staged to the backend immediately. Newly added ports become available for connection.

**REQ-050** User can increase or decrease the **control port count** on a module instance from the properties panel. Each change is staged to the backend immediately. Newly added ports become available for connection.

**REQ-051** When a port count is decreased, the backend determines whether the decrease is allowed. If rejected, the optimistic update is rolled back and an error toast is shown.

**REQ-052** User can increase or decrease the **data port count** on a subsystem from the properties panel. Each change is staged to the backend immediately. Newly added ports become available for connection.

**REQ-053** User can increase or decrease the **control port count** on a subsystem from the properties panel. Each change is staged to the backend immediately. Newly added ports become available for connection.

---

## 8. KV assignment — existing subgraph (palette-placed)

**REQ-022** When an existing subgraph is placed on the canvas, its supported KVs are loaded from the subgraph DTO returned with the subgraph contents.

**REQ-023** The **Key Configurator panel** for a selected existing subgraph shows a checklist of its supported KVs. User can select or unselect each entry. Each selection change is staged to the backend immediately.

**REQ-024** User can add a custom KV to an existing subgraph — one not present in the supported list. The addition is staged to the backend immediately.

---

## 9. KV assignment — newly created subgraph

**REQ-025** A newly created subgraph has no backend-provided supported KV list. The **Key Configurator panel** shows only a free-form "Add KV" form.

**REQ-026** User can add and remove KVs freely on a newly created subgraph. Each change is staged to the backend immediately.

---

## 10. KV state storage

**REQ-027** KV configuration state per subgraph is stored in `SubgraphConfigStore`, extended from the current implementation to track whether the subgraph is palette-placed or newly created.

**REQ-028** When a subgraph is removed from the canvas, its entry is cleared from `SubgraphConfigStore`.

---

## 11. Apply Changes

**REQ-029** An "Apply Changes" button is visible in edit mode and disabled while an Apply is in-flight.

**REQ-030** Apply sends the subgraph configuration (all subgraphs on canvas with their staged KV assignments) to the backend routing endpoint.

**REQ-031** On Apply success, the backend returns a **modification summary**. The UI displays this summary to the user. On failure, an error toast is shown and session state is preserved.

---

## 12. Persistence model

**REQ-032** Structural edits within subgraphs (add/delete modules, containers, links; port count changes; rename module, subgraph, or subsystem; subsystem subgraph assignments) are **staged to the backend immediately per operation** using an optimistic update pattern.

**REQ-033** KV changes (select/unselect, add/remove) are **staged to the backend immediately** — they are not held locally until Apply.

**REQ-034** Routing graph composition changes (placing a subgraph from the palette) are **session-local** and are only sent to the backend when Apply Changes is triggered.

**REQ-035** Optimistic update pattern: apply the change to local store immediately, fire the staging API call, roll back to the pre-edit snapshot on failure and show an error toast.

**REQ-036** Multi-step atomic operations (drag module to empty space: new subgraph + container + module) are staged as a single atomic unit — all three are rolled back together on failure.

---

## 13. Undo / redo *(future)*

**REQ-037** *(Future)* The backend returns a `changeId` with each successful staged edit response.

**REQ-038** *(Future)* The frontend maintains a `changeId` stack and exposes undo/redo via a change history panel in edit mode.

> **Open design problem:** Session-local palette subgraph placements have no backend `changeId`. Including them in the undo/redo stack requires either a client-side undo layer or staging palette drops to the backend on drop. This must be resolved before the undo/redo milestone is planned.

---

## 14. Palettes

**REQ-039** A **module palette** lists all module definitions, searchable and filterable. Each item is a draggable source. Multiple instances of the same definition are allowed on the canvas.

**REQ-040** A **subgraph palette** lists all subgraph definitions. Subgraphs already on the canvas are shown as disabled with a tooltip. Each draggable item triggers the existing subgraph placement flow (REQ-010).

**REQ-067** When a subgraph is dragged from the palette and dropped, a loading placeholder is shown at the drop position while the backend fetches the full subgraph contents. The placeholder is replaced by the rendered subgraph once the fetch completes. On fetch failure, the placeholder is removed and an error toast is shown.

**REQ-069** Dragging and dropping subgraphs from the subgraph palette is **not permitted when the canvas is in subsystem mode**. Palette items are shown as disabled in subsystem mode with a tooltip explaining the restriction.

---

## 15. Context menus

**REQ-041** Right-clicking a node shows a context menu. Available options vary by node type:
- Modules and containers: **Delete**
- Palette-placed or pre-loaded subgraph: **"Remove from canvas"** (palette-placed = UI cache only; pre-loaded = staged delete to backend)
- Newly created subgraph: **"Delete"** (staged delete + cascade)

**REQ-042** Right-clicking an edge shows a context menu with a **Delete** option.

**REQ-043** The **Delete key** triggers the same delete action as the context menu Delete option for any currently selected node or edge.

---

## 16. Properties panel

**REQ-044** Selecting a node opens a properties panel showing editable fields for that node type. For modules and subsystems, the panel includes port count controls (data and control, increase/decrease) per REQ-049 to REQ-053. Name fields are shown where renaming is supported.

---

## 17. Key Configurator panel

**REQ-045** The Key Configurator panel is accessible when a subgraph node is selected. It shows the KV assignment interface: a checklist of supported KVs for palette-placed subgraphs (REQ-023) or a free-form add form for newly created subgraphs (REQ-025).

---

## 18. MDF (Multi DSP Framework) use cases *(future)*

**REQ-056** *(Future)* KV assignment is not available for MDF subgraphs. The Key Configurator panel must not show KV options when the selected subgraph is of MDF type.

**REQ-057** *(Future)* When a user adds a connection between modules running on two different DSPs, the backend inserts additional bridge modules and connections to represent the cross-DSP path. The UI must support two display modes for this, controlled by user preference:
- **Expanded view**: shows the backend-generated bridge modules and connections explicitly on the canvas.
- **Virtual connection view**: shows a single logical connection line hiding the intermediate complexity.

---

## 19. Subgraph proxy node operations

**REQ-058** Connections cannot be created to or from a subgraph proxy node. During a connection operation, proxy node ports must be shown as invalid drop targets. This restriction exists because the proxy node represents a collapsed subgraph and the target module within it is ambiguous until expanded.

**REQ-059** User can rename a subgraph proxy node via the properties panel. The rename is staged to the backend immediately.

---

## 20. Positioning

**REQ-060** When a user drags and drops any component (module, subgraph) onto the canvas, it must be rendered at the exact drop coordinates (x, y). Auto-layout must not reposition a newly placed component away from the drop point.

**REQ-062** Users can drag any node (module, container, subgraph) to reposition it on the canvas. This is available in **both View and Edit modes**. Position changes are applied to the canvas immediately but are **not staged to the backend as part of the edit workflow** — they are persisted separately as layout overrides (persistence mechanism TBD with backend team).

---

## 21. Edit mode lifecycle

**REQ-063** While in edit mode, the tool must block the user from opening the **Discovery Wizard** or the **Diff/Merge** view. Both can modify the graph structure independently of the edit session, and the conflict resolution between them and staged edits is undefined. A tooltip or modal should explain why they are unavailable.

**REQ-064** If the user attempts to exit edit mode (toggle to View, close the project, or navigate away) while session-local changes exist (palette subgraph placements not yet applied), a confirmation prompt must warn that those session-local changes will be lost. The user must explicitly confirm before the exit proceeds.

---

## 22. Canvas interaction

**REQ-065** Users can **multi-select** nodes by Shift+clicking or by rubber-band drag-select on the canvas. Multi-select is available in **both View and Edit modes**. In Edit mode, a batch Delete operation applies to all selected nodes and edges simultaneously.

---

## Open items (TBD with backend team)

- **API contracts**: endpoint paths and DTO shapes for all staging operations, subgraph palette placement content fetch, subgraph-pairs API, atomic new-subgraph creation, KV staging, port count changes, routing apply, and undo/redo restore.
- **Subsystem CRUD backend API**: endpoint shapes for add, delete, rename, and subgraph assignment operations.
- **Position persistence**: mechanism for persisting layout overrides (REQ-062) outside the staged-edit workflow.
