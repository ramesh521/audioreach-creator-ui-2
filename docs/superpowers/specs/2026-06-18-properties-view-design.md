# Properties View — Design Spec

**Date:** 2026-06-18
**Branch:** feature/properties-view
**Author:** Ramesh Naidu

---

## 1. Overview

The Properties View is a panel widget that displays and edits the properties of
entities selected in the Use Case Visualizer. It supports a global read-only /
edit mode (controlled by a master toggle external to the panel), auto-saves
field changes immediately via PATCH calls, and is designed as a reusable widget
that can be mounted in any tab (graph designer, diff/merge, etc.) without
modification.

---

## 2. Entities and property sources

Eight entity types are selectable in the visualizer. Subgraph and Container
are listed first as they have the most complex property behaviour (mixed
graph-data and API sources). The remaining entities follow.

### 2.1 Subgraph

| Field | Source | Editable |
|---|---|---|
| Name | `graph-data-slice` | Yes — `PATCH /subgraphs/{id}` + update slice |
| Subgraph ID | `graph-data-slice` | No — copy icon only |
| All other properties (Performance Mode, SG Direction, Scenario ID, SGProp, Clock Scale Factor, Bus Bandwidth Scale Factor, VSID, etc.) | `GET /subgraphs/{id}/properties` | Yes — `PATCH /subgraphs/{id}/properties` (TBD — stubbed) |

`GET /subgraphs/{id}/properties` returns a self-describing `PropertyDto[]`
list containing both the schema (field names, types, display types) and
current values for every property except Name and Subgraph ID. No separate
definition endpoint call is needed — this single response is the complete
source of truth. The list is rendered by `SchemaPropertyRenderer`.

#### 2.1.1 Scenario ID change — property refresh

When the user changes Scenario ID, the backend transforms the subgraph's
property data: it deletes scenario-incompatible property groups and inserts
new ones with backend-populated defaults. The frontend must:

1. PATCH the new Scenario ID.
2. On success, re-fetch `GET /subgraphs/{id}/properties`.
3. Replace the cached property data in widget-local state.
4. Re-render the full properties list.

No client-side filtering is needed — the backend response is always the
authoritative set of active properties.

### 2.2 Container

| Field | Source | Editable |
|---|---|---|
| Container ID | `graph-data-slice` | Yes — `PATCH /containers/{id}` + update slice |
| Container Type | `graph-data-slice` | Yes — combobox; `PATCH /containers/{id}` + update slice |
| All other properties (Graph Position, Stack Size, Proc Domain, Container Heap, per-module heap list, Parent Container ID, Peer Container Heap, and data-driven groups) | `GET /containers/{id}/properties` | Yes — `PATCH /containers/{id}/properties` (TBD — stubbed) |

`GET /containers/{id}/properties` is self-describing — same single-response
pattern as Subgraph. No separate definition endpoint call needed.

One container supports exactly one type. The Container Type field is a
single combobox (the previous dual-list dialog is not implemented).

#### 2.2.1 Container Heap cascade

When the user changes Container Heap, the backend cascades the update to
all module heaps inside the container. After the PATCH resolves, the
frontend re-fetches `GET /spf-modules/{moduleId}/properties` for each
module in the container to display the backend-updated heap values.

### 2.3 Module

All fields are static — no properties endpoint call on module selection.

| Field | Source | Editable |
|---|---|---|
| Alias | `graph-data-slice` | Yes — `PATCH /arc-api/v1/projects/{projectId}/spf-modules` + update slice |
| Module ID | `graph-data-slice` | No — copy icon only |
| Instance ID | `graph-data-slice` | No — copy icon only |
| Container ID | `graph-data-slice` | Yes — `PATCH /arc-api/v1/projects/{projectId}/spf-modules` + update slice |
| Max Input Ports | `graph-data-slice` | Yes — `PATCH /arc-api/v1/projects/{projectId}/spf-modules` + update slice |
| Max Output Ports | `graph-data-slice` | Yes — `PATCH /arc-api/v1/projects/{projectId}/spf-modules` + update slice |
| Max Control Ports | `graph-data-slice` | Yes — `PATCH /arc-api/v1/projects/{projectId}/spf-modules` + update slice |
| Input Ports table | `graph-data-slice` | No |
| Output Ports table | `graph-data-slice` | No |

### 2.4 Subsystem

All fields are static — no properties endpoint call.

| Field | Source | Editable |
|---|---|---|
| Name | `graph-data-slice` | Yes — `PATCH /subsystems/{id}` + update slice |
| Subsystem ID | `graph-data-slice` | No — copy icon only |

### 2.5 Data Link

All fields are read-only. No API call on selection.

| Field | Source | Editable |
|---|---|---|
| Source Component Info (name + instance ID) | `graph-data-slice` | No |
| Source Port ID | `graph-data-slice` | No |
| Destination Component Info | `graph-data-slice` | No |
| Destination Port ID | `graph-data-slice` | No |

### 2.6 Control Link

| Field | Source | Editable |
|---|---|---|
| Peer1 Component Info | `graph-data-slice` | No |
| Peer1 Port ID | `graph-data-slice` | No |
| Peer2 Component Info | `graph-data-slice` | No |
| Peer2 Port ID | `graph-data-slice` | No |
| Intents table (IsUsed checkboxes) | `GET /control-links/{id}/properties` | Yes — `PATCH /control-links/{id}/properties` |
| Heap Property | `GET /control-links/{id}/properties` | Yes — `PATCH /control-links/{id}/properties` |
| Delete Link button | — | Action — fires `onDeleteLink(linkId)` |

### 2.7 Virtual Data Link

Two variants exist, distinguished by a dedicated `virtualDataLinkKind` field
on the entity:

#### Standard variant (`virtualDataLinkKind: 'standard'`)

Header: "Virtual Data Link Info". Shows a "Data Links" list. Each row:
source module (name + ID:port) → destination module (name + ID:port) with a
navigate (`>>|`) button and a delete (`×`) button per row.

| Control | Behaviour |
|---|---|
| Navigate button | Fires `onNavigateToNode(nodeId)` |
| Delete button | Fires `onDeleteLink(linkId)` |

#### MDF variant (`virtualDataLinkKind: 'mdf'`)

Header: "Virtual Data Link Info". Shows two sections:

- **Data Links** — read-only rows, each showing source → destination
  (name + ID:port). No navigate or delete buttons.
- **Modules** — read-only list of modules involved in the virtual link,
  each row showing: module name, processing domain, module ID.

> **Backend dependency:** the `virtualDataLinkKind` field is not yet present
> on the entity. A dedicated field is strongly preferred over inferring type
> from the presence of modules — an MDF link with zero modules would
> silently render as the wrong variant. This field should be added to the
> entity DTO before implementing the virtual data link card.

### 2.8 Virtual Control Link

Header: "Virtual Control Link Info". Shows a scrollable list of all real
control links contained within this virtual link. Each item in the list
shows:

- Peer1 and Peer2 Component Info (read-only)
- Intents table with IsUsed checkboxes
- Heap ID
- Delete button → fires `onDeleteLink(realLinkId)`

This mirrors the virtual data link list pattern, adapted for control link
data. There is no single "delete virtual link" action — only individual real
links can be deleted.

---

## 3. Multi-selection

When multiple entities are selected, cards are **grouped by entity type**.
Each group renders as a collapsible header showing the entity type name and
count (e.g., "Modules (3)", "Containers (2)"). Individual entity cards sit
inside their group and are independently collapsible.

Groups are rendered in a fixed order:
Subgraphs → Containers → Modules → Subsystems →
Data Links → Control Links → Virtual Data Links → Virtual Control Links.

Cards within a group are rendered in the order reported by
`selectedNodeIds` / `selectedEdgeIds`.

---

## 4. Edit mode

The properties panel has **no toggle button of its own**. Edit mode is
controlled by a master toggle in the host tab (e.g., the graph designer
toolbar). When the master toggle fires, the tab store updates `isEditing`
and the new value propagates to the panel via props.

When `isEditing: true`, all editable fields are interactive.
When `isEditing: false`, all fields are disabled display.

Always-read-only fields (IDs, port info, peer component info,
`DefinitionConfigElementDto` with `isReadOnly: true`) remain
non-interactive regardless of `isEditing`.

In read-only mode, **copy icon buttons on ID fields remain active** — that
is the only permitted interaction.

The diff/merge tab passes `isEditing={false}` permanently and exposes no
master toggle — the panel is always read-only there.

---

## 5. Auto-save

Every field change fires a PATCH call immediately. Text inputs are debounced
(300 ms) to avoid per-keystroke requests. Per-field error state is tracked
in widget-local state and shown inline next to the affected field.

---

## 6. Architecture

### 6.1 Widget boundary — props-driven design

`PropertiesPanel` accepts all external data via props and exposes callbacks
for writes. It has **no direct imports from any tab store**, making it
reusable across any tab.

```typescript
interface PropertiesPanelProps {
  projectId: string;
  graphData: UsecaseGraphData;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  isEditing: boolean;
  // Module — graph-data writes (graph view re-renders on change)
  onModuleAliasChange(moduleId: string, alias: string): void;
  onModulePortCountChange(
    moduleId: string,
    field: 'maxInputPorts' | 'maxOutputPorts' | 'maxControlPorts',
    value: number,
  ): void;
  onModuleContainerChange(moduleId: string, newContainerId: string): void;
  // Subsystem — graph-data write
  onSubsystemNameChange(id: string, name: string): void;
  // Subgraph — graph-data write
  onSubgraphNameChange(id: string, name: string): void;
  // Container — graph-data write
  onContainerIdChange(containerId: string, newId: string): void;
  // Links
  onDeleteLink(linkId: string): void;
  // Virtual link navigation
  onNavigateToNode(nodeId: string): void;
  // Diff/merge — omit in graph designer
  diffPropertyKeys?: Record<string, string[]>;
  onMergeSelectionsChange?: (selections: Record<string, string[]>) => void;
}
```

**Rule for callbacks in this interface:** a callback is included only when
the operation has impact outside the widget — specifically when `graph-data-slice`
must be updated so that the graph view re-renders. All other field changes
(Properties API fields such as SG Direction, Stack Size, Container Type, etc.)
are handled entirely inside the coordinator hooks via direct `entities/` API
calls with no adapter involvement.

### 6.2 FSD layer placement

```
entities/
  subgraphs/api/
    fetch-subgraph-properties.ts
    patch-subgraph.ts                    ← name update
    patch-subgraph-properties.ts         ← stub — endpoint TBD
  containers/api/
    fetch-container-properties.ts
    patch-container.ts                   ← id / type update
    patch-container-properties.ts        ← stub — endpoint TBD
  modules/api/
    patch-module.ts                      ← alias / port counts / container change
    fetch-module-properties.ts           ← per-module heap inside container card
    patch-module-properties.ts
  control-links/api/
    fetch-control-link-properties.ts
    patch-control-link-properties.ts
  subsystems/api/
    patch-subsystem.ts                   ← name update

shared/store/tab-store-slices/
  properties-view-slice.ts              ← isPropertiesPanelOpen only

widgets/properties-panel/
  model/
    use-module-card-data.ts
    use-subsystem-card-data.ts
    use-subgraph-card-data.ts
    use-container-card-data.ts
    use-data-link-card-data.ts
    use-control-link-card-data.ts
    use-virtual-data-link-card-data.ts
    use-virtual-control-link-card-data.ts
  ui/
    properties-panel.tsx                ← groups selection by entity type
    entity-cards/
      module-properties-card.tsx
      subsystem-properties-card.tsx
      subgraph-properties-card.tsx
      container-properties-card.tsx
      data-link-properties-card.tsx
      control-link-properties-card.tsx
      virtual-data-link-properties-card.tsx   ← renders standard or MDF variant
      virtual-control-link-properties-card.tsx
    shared/
      schema-property-renderer.tsx      ← walks PropertyDto[] list
      property-field.tsx                ← maps displayType to QUI control
  index.ts

shared/controls/
  copyable-id.tsx                       ← ID text + copy icon
  property-row.tsx                      ← label/value layout + optional action slot
```

### 6.3 Coordinator hooks

Each `use*CardData` hook:
- Receives `graphData`, `projectId`, entity ID, and a callbacks object as
  parameters — **no store imports**
- Fetches Properties API data into widget-local state on mount / ID change
- Returns a flat typed view model and typed update handlers
- Update handlers for graph-data fields call `entities/` API functions and
  invoke the corresponding `onXxx` prop callback; the adapter then updates
  the store

```typescript
function useSubgraphCardData(
  subgraphId: string,
  graphData: UsecaseGraphData,
  projectId: string,
  callbacks: SubgraphCardCallbacks,
): SubgraphCardViewModel
```

### 6.4 Widget-local state

API-fetched property values, loading states, and per-field error states are
held in widget-local `useState` / `useReducer`. They are **not** in the tab
store. The tab store retains only `isPropertiesPanelOpen`.

### 6.5 Consumer adapter pattern

```typescript
// widgets/graph-designer/ui/graph-designer-properties-panel.tsx
function GraphDesignerPropertiesPanel() {
  const graphData = useGraphDesignerStore(s => s.graphData);
  const selectedNodeIds = useGraphDesignerStore(s => s.selectedNodeIds);
  const selectedEdgeIds = useGraphDesignerStore(s => s.selectedEdgeIds);
  const isEditing = useGraphDesignerStore(s => s.isEditing);
  const store = useGraphDesignerStore.getState();

  return (
    <PropertiesPanel
      projectId={projectId}
      graphData={graphData}
      selectedNodeIds={selectedNodeIds}
      selectedEdgeIds={selectedEdgeIds}
      isEditing={isEditing}
      onSubgraphNameChange={(id, name) => {
        patchSubgraph(projectId, id, {name});
        store.updateSubgraphName(id, name);
      }}
      // ... other graph-data callbacks
      // diffPropertyKeys and onMergeSelectionsChange omitted
    />
  );
}

// Diff/merge adapter — always read-only, drives merge selection
function DiffPropertiesPanel() {
  const graphData = useDiffStore(s => s.baseGraphData);
  const diffPropertyKeys = useDiffStore(s => s.diffPropertyKeys);
  const store = useDiffStore.getState();

  return (
    <PropertiesPanel
      ...
      isEditing={false}
      diffPropertyKeys={diffPropertyKeys}
      onMergeSelectionsChange={(selections) =>
        store.setMergeSelections(selections)
      }
      // write callbacks omitted — panel is read-only
      onModuleAliasChange={() => {}}
      onModulePortCountChange={() => {}}
      onModuleContainerChange={() => {}}
      onSubsystemNameChange={() => {}}
      onSubgraphNameChange={() => {}}
      onContainerIdChange={() => {}}
      onDeleteLink={() => {}}
      onNavigateToNode={(nodeId) => store.focusNode(nodeId)}
    />
  );
}
```

---

## 7. Deletion cleanup

### 7.1 Selected entity deleted

When a node or edge is deleted it is removed from `selectedNodeIds` /
`selectedEdgeIds`. A `useEffect` in the widget evicts cached property data
for any IDs no longer present in the selection arrays.

### 7.2 Module deleted while container is selected

- `graphData.containers[id].modules` no longer contains the deleted module.
  Since `graphData` is a prop, the container card re-renders with the
  correct module list automatically.
- A `useEffect` diffs `graphData.moduleInstances` against cached module IDs
  and evicts stale `spf-module` property data from widget-local state.

---

## 8. Data-driven schema rendering

`SchemaPropertyRenderer` renders a `PropertyDto[]` list returned by the
properties endpoint. It maps each entry using its embedded schema
(field name, display type, editable flag) plus current values.

`PropertyField` maps `displayType` to a QUI control:

| displayType | QUI control |
|---|---|
| TextBox | `Input` |
| DropDown | `Select` |
| CheckBox | `Checkbox` |
| Slider | `Slider` |
| DbTextBox | `Input` (dB unit suffix) |
| QFormattedValue | `Input` (Q-format display) |
| StringField | `Input` |
| BitField | `Input` (hex display) |
| Formula | Read-only computed display |
| Dump / File | Read-only display |

Elements with `policy: Hidden` are never rendered. Elements where
`isReadOnly: true` on the property definition are never interactive.

---

## 9. Shared controls

Two domain-agnostic components promoted to `shared/controls/`:

- **`CopyableId`** — ID string with copy-to-clipboard icon. The copy action
  is active in both edit and read-only mode.
- **`PropertyRow`** — label-left / value-right two-column layout. Accepts
  an optional `renderAction` slot rendered at the leading edge of the row.
  In graph designer this slot is unused. In diff/merge it renders a merge
  checkbox per property.

---

## 10. Diff/merge integration

When the diff/merge tab mounts `PropertiesPanel` it provides two optional
props:

- **`diffPropertyKeys: Record<string, string[]>`** — maps each entity ID to
  the list of property keys that differ between the target and reference
  files. The widget renders a checkbox next to every property whose key
  appears in this map. A card-level checkbox is rendered in the entity card
  header whenever at least one of its properties has a checkbox; its
  checked / indeterminate / unchecked state is derived from the children.

- **`onMergeSelectionsChange: (selections: Record<string, string[]>) => void`**
  — fires on every checkbox change with the full current selection (entity
  ID → selected property keys). The diff/merge tab stores this in its own
  store and uses it to execute the merge.

The widget owns the checkbox state and the card-level derivation logic. The
diff/merge tab owns the merge execution. The properties panel is unaware of
merge semantics beyond rendering and reporting selections.

---

## 11. Out of scope

- Undo/redo for property edits
- Bulk editing across multiple selected entities of the same type
- Property search / filter within the panel
- Validation beyond per-field inline errors returned by the PATCH response
- Merge conflict resolution UI beyond per-property and per-card checkboxes
