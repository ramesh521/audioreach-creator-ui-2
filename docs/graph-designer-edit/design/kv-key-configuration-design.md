# Graph Designer Edit — KV & Key Configuration Design

Requirements: [../requirements/graph-designer-edit-requirements.md](../requirements/graph-designer-edit-requirements.md)
(REQ-039–043, 052–054, 071)

Covers the Key Configurator panel's behavior for every node type it
supports: KV assignment for subgraphs, CKV/TKV for modules, and Keys
assignment for subsystems. All operations here assume the edit session
(`core-edit-session-design.md`) is active and reuse the `provenance` field
from `node-operations-design.md`. Most assignment here is UI-only until
Apply Changes (no backend call, so no loading state applies) — the one
exception is CKV/TKV (REQ-053), which stages immediately and is wrapped in
`core-edit-session-design.md`'s `isMutating` lock (REQ-065) like
every other backend-calling action in this feature.

## Table of Contents

- [KV Assignment — Existing Subgraphs](#kv-assignment--existing-subgraphs)
- [KV Assignment — Newly-Created Subgraphs](#kv-assignment--newly-created-subgraphs)
- [Panel Routing](#panel-routing)
- [CKV/TKV — Modules](#ckvtkv--modules)
- [Keys Assignment — Subsystems](#keys-assignment--subsystems)
- [MDF Exclusion](#mdf-exclusion)
- [Open Items Inherited](#open-items-inherited)

---

## KV Assignment — Existing Subgraphs

**REQ-039 — loading.** Supported KVs come from the same
`getSubgraphContents` DTO used for placement (REQ-012,
`node-operations-design.md`) — no separate fetch. Nothing is auto-selected.

**REQ-040–041 — storage shape.** A bare `selectedKvIds: string[]` cannot
represent "known but unselected" without diffing against the DTO's
supported list externally, and that diffing breaks down entirely for
custom/user-added KVs which aren't in the supported list at all. Instead,
each subgraph node carries a single self-describing array:

```typescript
interface KvAssignment {
  id: string;
  key: string;
  value: string;
  source: 'supported' | 'custom'; // from the backend DTO vs. user-added (REQ-041)
  selected: boolean;
}

interface Subgraph {
  // ...existing fields, including provenance...
  kvAssignments: KvAssignment[];
}
```

**Custom KV entry is a picker against the project-wide Key/Value catalog,
not free text.** REQ-041/043's "add a custom KV" reuses the same
`getAllKeyDefinitions`/`GraphKey.values: KeyValue[]` catalog the CKV/TKV
panel already uses to populate its own key/value pickers — the user picks
a `Key` (by `name`) and then one of its `KeyValue` entries (also by
`name`), and those two names populate `key`/`value` above. This keeps
"custom" scoped to "not in this subgraph's `supportedKvs` list," not
"arbitrary unvalidated string" — the Key/Value pair itself still comes from
the same catalog every other Key-typed UI in the app draws from.

- **On placement (REQ-039):** `kvAssignments` is seeded from the DTO's
  `supportedKvs`, each entry `{source: 'supported', selected: false}`.
- **Checklist toggle (REQ-040):** flips `selected` in place. Both selected
  and unselected entries stay visible in the same array — the checklist
  renders directly from it, no external bookkeeping needed. UI-only, not
  sent to the backend until Apply Changes.
- **Custom KV add (REQ-041):** appends `{source: 'custom', selected: true}`
  — adding a KV implies wanting it applied. UI-only, not sent until Apply.
- **Apply Changes** (`core-edit-session-design.md`) reads
  `kvAssignments.filter((kv) => kv.selected)` per subgraph to build its
  payload. This single array is both the checklist's render source and the
  Apply-time source of truth.

**Custom KV removal is asymmetric by subgraph provenance.** On a
palette-placed (existing) subgraph, a custom KV added per REQ-041 can only
be unchecked (`selected: false`) — REQ-041 grants "add," not "remove," so
outright deletion of the entry is not available here. This distinction is
easy to miss from the requirements text alone and must be enforced in the
Key Configurator panel's rendering: the delete-entry affordance on a custom
KV row is only shown when the owning subgraph's `provenance ===
'newly-created'` (see the next section).

---

## KV Assignment — Newly-Created Subgraphs

**REQ-042–043.** A newly-created subgraph has no backend-provided supported
KV list — the panel shows only a free-form "Add KV" form. This reuses the
exact same `kvAssignments: KvAssignment[]` shape above; the only difference
is which UI renders (checklist vs. free-form-only), decided by
`provenance`, not a data-model difference:

- Seeded empty at creation — no `supported`-source entries, since there's
  no DTO to seed from.
- Every user-added entry gets `{source: 'custom', selected: true}`.
- **Outright removal (splicing the entry out, not just unchecking) is
  available here**, per REQ-043's "add and remove freely" — in contrast to
  the palette-placed case above, where a custom entry can only be
  unchecked.

---

## Panel Routing

**REQ-052.** The Key Configurator panel's content is a dispatch on the
currently-selected node's type, read from `GraphDesignerStore`'s
properties/selection slice:

| Selected node | Panel content |
| --- | --- |
| Subgraph (`palette-placed` or `pre-loaded`) | KV checklist — above |
| Subgraph (`newly-created`) | Free-form add — above |
| Subsystem | Keys assignment — below |
| Module | CKV/TKV configuration — below |

**`pre-loaded` subgraphs use the same checklist UI as `palette-placed`
ones** (REQ-039–040 do not distinguish the two — REQ-039's text says
"existing subgraph," and the requirements doc's own section heading, "KV
assignment — existing subgraph (palette-placed)," undersells this: a
subgraph already on canvas when Edit mode is entered is exactly the same
"existing" case, just with a different provenance value). The only
difference is where `kvAssignments` is seeded from: a `pre-loaded`
subgraph's `kvAssignments` is seeded at Edit-mode entry (not at
`getSubgraphContents` fetch time, since it was never fetched via that
call) from the same `supportedKvs`/prior-selection data already present
in whatever DTO populates the canvas on entering Edit mode — the seeding
*mechanism* is identical to REQ-039's, just triggered at a different point
in the session lifecycle.

No new state — pure render-branching in the panel component.

---

## CKV/TKV — Modules

**REQ-053 — important distinction.** Unlike every other assignment in this
document, CKV/TKV changes are **staged to the backend immediately**, not
batched into Apply Changes. This follows the "call backend now, canvas
reflects only after confirmation" pattern from
`core-edit-session-design.md`/`node-operations-design.md` instead of the
"UI-only until Apply" pattern used elsewhere in this document.

**This requires new work, not just wiring — the existing panel does not
yet stage to the backend.** The Key Configurator panel already exists
(`packages/react-app/src/features/key-configurator/`), used outside edit
mode today for cal/tag tuning, but its current persistence path is a
**batch-save stub, not an immediate-stage pattern**: `useCalibrationKeysStore`'s
`addConfiguredKey`/`updateConfiguredKeyValues`/`removeConfiguredKey`
(`model/calibration-keys-store.ts`) are synchronous local-state mutations
with no backend call at all; the only network path,
`saveToBackend()`, is an unimplemented stub that logs `'Backend save not
yet implemented'` and always resolves `false` (mirrored identically in
`module-tag-keys-store.ts`, `subgraph-config-store.ts`, and
`subsystem-config-store.ts`). `KeyConfiguratorStore.saveConfiguration()`
calls all four `saveToBackend()`s in parallel but is itself unwired to any
UI trigger — the panel's own Save handler is commented out.

For REQ-053, this means: **each CKV/TKV add/edit/remove action must be
rewritten to call the backend immediately** (the same "backend call →
merge on success → toast on failure" pattern used throughout the rest of
this feature, wrapped in `isMutating`), replacing the current
click-to-local-state-then-batch-save-later flow entirely for the edit-mode
Key Configurator panel. This is real implementation work — building the
per-action backend calls that don't exist yet — not a reuse of already-working code.

---

## Keys Assignment — Subsystems

**REQ-071.** Distinct from subgraph KV assignment: a "Key" here carries no
value, just an identifier. Like KV assignment, this is **UI-only, staged at
Apply** — `core-edit-session-design.md`'s `applyChanges()` reads
`assignedKeyIds` off every subsystem node on canvas as part of its request
payload, alongside subgraph `kvAssignments`. Because REQ-071 does not
describe a backend-provided candidate list to check items off against —
unlike KV's `supportedKvs` — the shape is simpler than `KvAssignment`, a
plain ID list on the subsystem node:

```typescript
interface Subsystem {
  // ...existing fields...
  assignedKeyIds: string[];
}
```

**Entry is a picker against the project-wide Key catalog, not free text.**
The app already models keys via `Key {id: number; name: string}`
(`shared/types/key-configurator-config.types.ts`), sourced project-wide via
the existing `getAllKeyDefinitions` call used by the CKV/TKV panel. REQ-071
assignment reuses that same catalog and picker pattern rather than
introducing free-form text entry — `assignedKeyIds` holds `Key.id` values
(stringified) selected from that list, keeping this Keys-assignment surface
consistent with every other Key-typed UI in the app.

---

## MDF Exclusion

**REQ-054.** KV assignment is unavailable for MDF-type subgraphs — the Key
Configurator panel must not render KV options when the selected subgraph's
type is MDF. A pure render-condition guard in the REQ-052 panel-routing
logic:

```typescript
const isMdf = subgraph.subgraphType.toUpperCase() === 'MDF';
```

No `MDF` constant exists anywhere in the codebase today (confirmed by
search) — `subgraphType` is a free-form string from the backend DTO, so
this comparison is this feature's first consumer of that value and fixes
the exact expected literal (case-insensitive) pending backend
confirmation. No new state.

---

## Open Items Inherited

- **API contracts** for KV/CKV/TKV staging and the routing/apply payload
  shape for KV assignments and subsystem Keys — TBD with the backend team,
  per the requirements doc's own open items.
