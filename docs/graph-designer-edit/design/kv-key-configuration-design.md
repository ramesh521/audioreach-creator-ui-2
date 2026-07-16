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
`core-edit-session-design.md`'s `withMutationLock` (REQ-065), which also
enforces `mode === 'edit'` — same as every other backend-calling action in
this feature.

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
`getSubgraphContents` response used for placement (REQ-012,
`node-operations-design.md`) — no separate fetch:
`SubgraphDto.SGKV: KeyValuePairsInfo[]`. Nothing is auto-selected.

**SGKV is a list of selectable *cases*, not a flat list of individual
KVs.** Each `KeyValuePairsInfo` entry is `{systemId, keyValueCollection:
KeyValueInfo[]}` — one whole combination of Key+Value pairs
(`KeyValueInfo = {keyInfo: KeyInfo, valueInfo: ValueInfo}`) that the
subgraph supports as a unit. The Apply-time payload confirms this
case-level granularity: `SubgraphKvSelectionDto.valueSystemIds:
string[][]` is "one inner array per case, containing the value system IDs
of the KVs active in that case" — so selection happens at the case level
(a whole `KeyValuePairsInfo` entry is selected or not), not by toggling
individual Key=Value pairs within a case independently. This replaces an
earlier draft of this document that modeled `KvAssignment` as a flat
`{key: string, value: string}` pair with its own `selected` flag — that
doesn't match the real API, which has no per-KV-pair selection, only
per-case.

**REQ-040–041 — storage shape.** A bare `selectedCaseIds: string[]` cannot
represent "known but unselected" without diffing against the DTO's case
list externally, and that diffing breaks down entirely for custom/user-added
cases which aren't in the supported list at all. Instead, each subgraph
node carries a single self-describing array of cases:

```typescript
interface KvCase {
  id: string; // this case's own SGKV systemId if supported; a client-generated placeholder if custom (never sent to the backend as a systemId)
  keyValuePairs: KeyValueInfo[]; // mirrors KeyValuePairsInfo.keyValueCollection — {keyInfo: KeyInfo, valueInfo: ValueInfo}[]
  source: 'supported' | 'custom'; // from SGKV vs. user-added (REQ-041)
  selected: boolean;
}

interface Subgraph {
  // ...existing fields, including provenance...
  kvCases: KvCase[];
}
```

**Custom KV entry is a picker against the project-wide Key/Value catalog,
not free text, and produces a one-pair case.** REQ-041/043's "add a custom
KV" reuses the same `getAllKeyDefinitions`/`GraphKey.values: KeyValue[]`
catalog the CKV/TKV panel already uses to populate its own key/value
pickers — the user picks a `Key` and then one of its `Value` entries, and
that single `{keyInfo, valueInfo}` pair becomes a new `KvCase` with
exactly one entry in `keyValuePairs`. This keeps "custom" scoped to "not
one of this subgraph's SGKV cases," not "arbitrary unvalidated string" —
the Key/Value pair itself still comes from the same catalog every other
Key-typed UI in the app draws from. (The requirements text's "custom KV"
is singular by design — a custom *case* of more than one pair is not a
REQ-041 scenario.)

- **On placement (REQ-039):** `kvCases` is seeded one-to-one from the
  DTO's `SGKV` array, each entry `{id: kv.systemId, keyValuePairs:
  kv.keyValueCollection, source: 'supported', selected: false}`.
- **Checklist toggle (REQ-040):** flips `selected` in place on the whole
  case. Both selected and unselected cases stay visible in the same array
  — the checklist renders directly from it, no external bookkeeping
  needed. UI-only, not sent to the backend until Apply Changes.
- **Custom KV add (REQ-041):** appends a new one-pair case,
  `{id: <client-generated>, keyValuePairs: [{keyInfo, valueInfo}],
  source: 'custom', selected: true}` — adding implies wanting it applied.
  UI-only, not sent until Apply.
- **Apply Changes** (`core-edit-session-design.md`) builds each
  subgraph's `SubgraphKvSelectionDto` from
  `kvCases.filter((c) => c.selected).map((c) => c.keyValuePairs.map((p) =>
  p.valueInfo.valueSystemId))` — one inner `string[]` per selected case,
  listing that case's value system IDs. This single array is both the
  checklist's render source and the Apply-time source of truth.

**Custom KV removal is asymmetric by subgraph provenance.** On a
palette-placed (existing) subgraph, a custom case added per REQ-041 can
only be unchecked (`selected: false`) — REQ-041 grants "add," not
"remove," so outright deletion of the entry is not available here. This
distinction is easy to miss from the requirements text alone and must be
enforced in the Key Configurator panel's rendering: the delete-entry
affordance on a custom case row is only shown when the owning subgraph's
`provenance === 'newly-created'` (see the next section).

---

## KV Assignment — Newly-Created Subgraphs

**REQ-042–043.** A newly-created subgraph has no backend-provided SGKV
list — the panel shows only a free-form "Add KV" form. This reuses the
exact same `kvCases: KvCase[]` shape above; the only difference is which
UI renders (checklist vs. free-form-only), decided by `provenance`, not a
data-model difference:

- Seeded empty at creation — no `supported`-source entries, since there's
  no DTO to seed from.
- Every user-added entry gets a new one-pair `KvCase`,
  `{source: 'custom', selected: true}`, same as REQ-041 above.
- **Outright removal (splicing the case out, not just unchecking) is
  available here**, per REQ-043's "add and remove freely" — in contrast to
  the palette-placed case above, where a custom case can only be
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
difference is where `kvCases` is seeded from: a `pre-loaded`
subgraph's `kvCases` is seeded at Edit-mode entry (not at
`getSubgraphContents` fetch time, since it was never fetched via that
call) from the same `SGKV`/prior-selection data already present
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
value, just an identifier. Like KV assignment, this is intended to be
**UI-only, staged at Apply** — but unlike subgraph KV assignment, **there
is no confirmed backend contract for this at all.**
`core-edit-session-design.md`'s `CreateUsecasesRequestDto` (the real,
confirmed Apply Changes payload) has no field for subsystem keys, and
`SubsystemDto.filteredKeys` — the closest existing field — is read-only
query data, not a mutation target. This design proceeds with a UI-side
model on the assumption a home for it will be added, but where/how it
reaches the backend on Apply is a genuinely open item (see
`core-edit-session-design.md`'s Open Items), not merely an unconfirmed
path/DTO name on an otherwise-real endpoint. Because REQ-071 does not
describe a backend-provided candidate list to check items off against —
unlike KV's `SGKV` — the shape is simpler than `KvCase`, a plain ID list
on the subsystem node:

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

- **API contract for CKV/TKV staging** — TBD with the backend team; the
  Key Configurator panel's existing `saveToBackend()` stubs (REQ-053,
  above) need real per-action endpoints that don't exist yet.
- **Subsystem Keys assignment (REQ-071) backend contract** — no confirmed
  home in the API at all, per the Keys Assignment section above; flagged
  in `core-edit-session-design.md`'s Open Items as well. Subgraph KV
  assignment, by contrast, is now confirmed via `CreateUsecasesRequestDto`/
  `SubgraphKvSelectionDto` — no longer an open item for its own contract.
