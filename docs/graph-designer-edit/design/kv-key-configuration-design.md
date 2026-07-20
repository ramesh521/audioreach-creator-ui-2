# Graph Designer Edit — KV & Key Configuration Design

Requirements: [../requirements/graph-designer-edit-requirements.md](../requirements/graph-designer-edit-requirements.md)
(REQ-039–043, 052–054, 071)

Covers the Key Configurator panel's behavior for every node type it
supports: KV assignment for subgraphs, CKV/TKV for modules, and Keys
assignment for subsystems. All operations here assume the edit session
(`core-edit-session-design.md`) is active and reuse the `provenance` field
from `node-operations-design.md`. Subgraph KV assignment is UI-only until
Apply Changes (no backend call, so no loading state applies); CKV/TKV
(REQ-053) and subsystem Keys assignment (REQ-071) are the two exceptions —
both stage immediately and are wrapped in `core-edit-session-design.md`'s
`withMutationLock` (REQ-065), which also enforces `mode === 'edit'` — same
as every other backend-calling action in this feature.

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

**REQ-039 — loading, and where `SGKV` actually comes from.** An earlier
draft of this document assumed `SGKV` arrived on `getSubgraphContents`'s
response and, separately, that it might not exist on any real DTO at
all. Both are now resolved: `SGKV: KeyValuePairsInfo[]` is a confirmed
field on the real `SubgraphDto` returned by `getAllSubgraphs(projectId)`
(`entities/subgraph-definitions` — the same endpoint the subgraph palette
already calls), alongside `changeInfo`, `systemId`, `id`, `name`,
`relatedEndPointLinks`, `scenarioType` (`Audio`/`Voice`), `deviceType`
(`Stream`/`Device`/`Stream_Device`/`Stream_PP`/`Device_PP`), and
`subGraphSharedType`. `getSubgraphContents` (`ComponentCollectionDto`)
never carried it and was never going to — that response has no
subgraph-level object to attach a field to at all. **The frontend
`SubgraphDto` type is stale against this schema and needs updating** —
see `core-edit-session-design.md`'s Open Items. Nothing is
auto-selected once loaded.

**`SGKV` reaches the Key Configurator panel via three different fetches,
one per subgraph provenance — not one shared call.**

| Provenance | When fetched | Source |
| --- | --- | --- |
| `pre-loaded` | At use-case selection, before Edit mode is entered | `getAllSubgraphs(projectId)`, filtered to the subgraph IDs the use-case load resolves — see `core-edit-session-design.md`'s Mode State section |
| `palette-placed` | At drop time (REQ-012) | A net-new single-subgraph-by-`systemId` endpoint — not yet in the API, see Open Items |
| `newly-created` | Never — no fetch at all | `kvCasesById` seeded empty per REQ-042, below — a newly-created subgraph has no backend SGKV to fetch |

Each of these seeds `EditSessionSlice.kvCasesById` (below) for that
subgraph, independently, at whichever moment that subgraph's provenance
implies — this is not one shared "fetch SGKV" function called from three
places, since the fetch shape and trigger point genuinely differ per
provenance.

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
cases which aren't in the supported list at all. Instead, each case is a
single self-describing object:

```typescript
interface KvCase {
  id: string; // this case's own SGKV systemId if supported; a client-generated placeholder if custom (never sent to the backend as a systemId)
  keyValuePairs: KeyValueInfo[]; // mirrors KeyValuePairsInfo.keyValueCollection — {keyInfo: KeyInfo, valueInfo: ValueInfo}[]
  source: 'supported' | 'custom'; // from SGKV vs. user-added (REQ-041)
  selected: boolean;
}
```

**`KvCase[]` lives in `EditSessionSlice.kvCasesById`, keyed by subgraph
ID — not as a field on the derived `Subgraph` object.** See
`core-edit-session-design.md`'s Response Reconciliation section: the
derived `Subgraph` object is rebuilt from scratch on every
`recomputeContainersAndSubgraphs` pass, so a field placed directly on it
would be silently lost the next time *any* edit anywhere on canvas
triggers a recompute. `kvCasesById` is seeded once per subgraph, at
whichever of the three moments in the table above applies to that
subgraph's provenance, and is never reseeded from backend KV data after
that — the SGKV response (where one exists) is consulted exactly once, to
build the initial array; from that point on, `kvCasesById` is the only
place KV selection state lives, and every subsequent recompute leaves it
untouched. There is no need to keep the raw `SGKV`/`KeyValuePairsInfo[]`
response around after that initial seed — nothing about this feature ever
needs the *backend's original* KV list again once `kvCasesById` exists;
the backend only needs whichever KVs end up selected on Apply, regardless
of whether they originated from its own SGKV list or from a user-added
custom case.

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

- **On placement (REQ-039):** `kvCasesById.set(subgraphId, ...)` is
  seeded one-to-one from the response's `SGKV` array, each entry
  `{id: kv.systemId, keyValuePairs: kv.keyValueCollection, source:
  'supported', selected: false}`.
- **Checklist toggle (REQ-040):** flips `selected` in place on the whole
  case, within `kvCasesById.get(subgraphId)`. Both selected and
  unselected cases stay visible in the same array — the checklist renders
  directly from it, no external bookkeeping needed. UI-only, not sent to
  the backend until Apply Changes.
- **Custom KV add (REQ-041):** appends a new one-pair case,
  `{id: <client-generated>, keyValuePairs: [{keyInfo, valueInfo}],
  source: 'custom', selected: true}` — adding implies wanting it applied.
  UI-only, not sent until Apply.
- **Apply Changes** (`core-edit-session-design.md`) builds each
  subgraph's `SubgraphKvSelectionDto` from
  `kvCasesById.get(subgraphId).filter((c) => c.selected).map((c) =>
  c.keyValuePairs.map((p) => p.valueInfo.valueSystemId))` — one inner
  `string[]` per selected case, listing that case's value system IDs.
  This single map is both the checklist's render source and the
  Apply-time source of truth. If nothing is selected, this produces
  `valueSystemIds: []` — the subgraph still gets an entry in
  `activeSubgraphs`, never an omitted one (`core-edit-session-design.md`'s
  Apply Changes section); this applies identically whether the empty
  selection is because the user hasn't checked anything or because the
  subgraph is MDF and never had a checklist to select from (below).

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
exact same `kvCasesById` map above; the only difference is which UI
renders (checklist vs. free-form-only), decided by `provenance`, not a
data-model difference:


- Seeded empty at creation (`kvCasesById.set(subgraphId, [])`) — no
  `supported`-source entries, since there's no DTO to seed from.
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
| Container or edge | No content — none of the above apply |

**`pre-loaded` subgraphs use the same checklist UI as `palette-placed`
ones** (REQ-039–040 do not distinguish the two — REQ-039's text says
"existing subgraph," and the requirements doc's own section heading, "KV
assignment — existing subgraph (palette-placed)," undersells this: a
subgraph already on canvas when Edit mode is entered is exactly the same
"existing" case, just with a different provenance value). The only
difference is when `kvCasesById` is seeded: a `pre-loaded` subgraph's
entry is seeded at use-case-selection time, in View mode, before Edit
mode is even entered (`core-edit-session-design.md`'s Mode State
section), rather than at `getSubgraphContents` fetch time (since it was
never fetched via that call) — the seeding *mechanism* is identical to
REQ-039's, just triggered at a different point in the session lifecycle.

No new state — pure render-branching in the panel component.

---

## CKV/TKV — Modules

**REQ-053 — important distinction.** Unlike every other assignment in this
document, CKV/TKV changes are **staged to the backend immediately**, not
batched into Apply Changes. This follows the "call backend now, canvas
reflects only after confirmation" pattern from
`core-edit-session-design.md`/`node-operations-design.md` instead of the
"UI-only until Apply" pattern used elsewhere in this document.

**Resolved: `discardChanges` (omitted `changeIds`) does revert CKV/TKV
changes, confirmed with the backend team.** Staging immediately does not
make a CKV/TKV entry durable against a subsequent Discard — "immediate"
here means "reflected on confirmation," not "exempt from discard." This
matters most for a module created earlier in the same session: if that
module's own creation is discarded, any CKV/TKV entries staged onto it in
the meantime are discarded along with it, consistently — there is no
partial state where the module disappears but its CKV/TKV entries survive
orphaned. See `core-edit-session-design.md`'s Discard section for the
general statement of this and the Keys Assignment section below for the
identical resolution on the subsystem-Keys side.

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

**Correction: the confirmed response must also reconcile into
`GraphDataSlice`, not stop at the four `features/key-configurator` stores.**
An earlier draft of this section specified only that each store's
`saveToBackend()` needed a real implementation, with no further requirement
on what happens to the response. That's incomplete against
`core-edit-session-design.md`'s architectural principle (see that
document's Architecture section): `calibration-keys-store.ts`/
`module-tag-keys-store.ts`/`subgraph-config-store.ts`/
`subsystem-config-store.ts` are independent of `GraphDesignerStore`, so a
CKV/TKV mutation confirmed only within one of those stores is invisible to
the canvas and to any other open panel reading the same module's data from
`GraphDataSlice` — the exact failure mode already diagnosed for
`kvCasesById`/`provenance` elsewhere in this feature, here at the scale of
an entire store family rather than one field. Concretely, each rewritten
CKV/TKV action's success path must, in the same step that updates the
owning `features/key-configurator` store, also write the confirmed value
onto the affected module's own representation in
`GraphDataSlice.moduleInstances` (CKV/TKV values are module-scoped, per
REQ-053's own definition — "a module can have multiple CKV/TKV entries" —
so this is a direct field update on the one already-known module, the same
narrow-response treatment `updatePortCount`/renames already use, not a
`ComponentCollectionDto` reconciliation). Whether the `features/key-configurator`
stores remain the panel's own rendering source of truth, with `GraphDataSlice`
receiving a copy, or whether `GraphDataSlice` becomes the sole source and the
panel reads from it directly, is an implementation-time decision not settled
here — either way, the constraint is that a confirmed CKV/TKV change must be
reachable from `GraphDataSlice`, not sealed inside the key-configurator store
family alone.

---

## Keys Assignment — Subsystems

**REQ-071.** Distinct from subgraph KV assignment: a "Key" here carries no
value, just an identifier. **This is staged to the backend immediately on
each assign/unassign action — the same "call backend now, panel reflects
only after confirmation" pattern REQ-053 uses for CKV/TKV** — not batched
into Apply Changes. An earlier draft of this design modeled Keys
assignment as UI-only, staged at Apply, the same as subgraph KV
assignment; that's been changed so the panel and canvas reflect the
assignment immediately rather than waiting for Apply.

**Resolved: immediate-staging does not protect a Keys assignment from a
subsequent Discard — confirmed with the backend team, matching REQ-053's
identical resolution above.** `core-edit-session-design.md`'s confirmed
Discard contract states, per the API's own documentation, "If `changeIds`
is not provided or empty, all changes will be discarded," and
`confirmDiscard()` always omits `changeIds`; there is no carve-out for
Keys-assignment or CKV/TKV changeIds. Every staged edit, including an
immediate-stage Keys assignment, is discarded along with everything else
in the session. Consequently, "staging immediately avoids losing the
assignment on Discard" is **not** a benefit this design actually provides
— the only benefit immediate-staging retains is that the panel/canvas
reflect the assignment right away rather than waiting for Apply, the same
as CKV/TKV. A Keys assignment made on a subsystem created earlier in the
same session is discarded consistently along with that subsystem if the
session is discarded — there is no orphaned-assignment case.

**There is still no confirmed backend contract for this — the change is
about the frontend's own staging design, not about the endpoint existing.**
`core-edit-session-design.md`'s `CreateUsecasesRequestDto` correctly has no
field for subsystem keys now (immediate-stage means Apply has nothing to
carry), but no per-action staging endpoint exists in the API either;
`SubsystemDto.filteredKeys` — the closest existing field — remains
read-only query data, not a mutation target. This design proceeds with a
UI-side model on the assumption a staging endpoint will be added; where/how
it's called is a genuinely open item (see `core-edit-session-design.md`'s
Open Items).

**`filteredKeys` is read and written directly on `GraphDataSlice`'s
`Subsystem` node — no separate `EditSessionSlice` map.** An earlier draft
of this section introduced `EditSessionSlice.assignedKeyIdsBySubsystemId`,
reasoning by analogy to `subgraphProvenanceById`/`kvCasesById`: those two
need their own map because they are frontend-only concepts the backend has
no field for at all, so there is nothing to reconcile from on a recompute.
`filteredKeys` is different — it is a **real backend field**, already
present on every `SubsystemDto` the moment use cases are selected (the
same `queryUsecaseComponents`/`getComponentsForSubgraph` load path every
other entity in this feature loads through), and on a newly-created
subsystem's `SubsystemDto` the moment `moveToSubsystem`'s `createNew`
response lands. There is no seed-from-nothing problem to solve here, so the
map added no value it didn't already have sitting in `GraphDataSlice`:

- **Read**: the Key Configurator panel's Keys checklist reads
  `graphData.subsystems[subsystemId].filteredKeys` directly — whatever is
  currently loaded for the selected subsystem, no separate lookup.
- **Write, on assign/unassign**: the response below is not a full
  `SubsystemDto`, so its success handler writes `assignedKeyIds` straight
  onto that one field —
  `graphData.subsystems[subsystemId].filteredKeys = assignedKeyIds` — the
  same single-field, narrow-response update renames/`updatePortCount`
  already use, just targeting the node directly instead of through an
  intermediate map.
- **Write, on every other subsystem-bearing response** (a REQ-031a move, a
  `-with-subsystems` link create, a future subsystem port-count change):
  `upsertSubsystem` already replaces the whole `Subsystem` node from that
  response's `SubsystemDto`, including `filteredKeys` — no separate
  handling needed, this is the existing reconciliation path unchanged.

Because there is no map, there is nothing to seed at Edit-mode entry and
nothing to clear on the `'view'` transition — `graphData.subsystems` is
already fully replaced by the ordinary View-mode `loadGraphData` reload,
which is a stronger reset than a map-clear would have been.

**One dependency this relies on, not yet confirmed with the backend team:
every subsystem-bearing mutation response must carry an accurate
`filteredKeys` on its `SubsystemDto`, not a stale or omitted one.** If, for
example, `moveToSubsystem`'s response DTO does not bother recomputing
`filteredKeys` since that endpoint isn't mutating keys, its `upsertSubsystem`
call would silently overwrite a just-confirmed Keys assignment with a stale
value. This is a narrower, more concrete question than the map-vs-no-map
choice above and is tracked in [Open Items Inherited](#open-items-inherited),
below.

**Assign/unassign call the (TBD) staging endpoint immediately, under
`withMutationLock`, and update `Subsystem.filteredKeys` only from the
confirmed response — not optimistically:**

```typescript
assignSubsystemKey(subsystemId: string, keyId: string): Promise<{assignedKeyIds: string[]}>
unassignSubsystemKey(subsystemId: string, keyId: string): Promise<{assignedKeyIds: string[]}>
```

Following the same convention as `updatePortCount`'s `{updatedPorts}`
(`link-and-port-design.md`) — the response is the subsystem's complete,
current assigned-key list, not a delta, so the consumer replaces (not
appends to) `graphData.subsystems[subsystemId].filteredKeys` wholesale on
success. On failure, standard toast + no-change-applied, same as every
other backend-calling action in this feature. This is one of the "what
does *not* go through [the `ComponentCollectionDto`] mechanism" cases
(`core-edit-session-design.md`) — assigning a key only ever affects one
already-known subsystem's own bookkeeping, not a cascade, so a narrow
response shape is correct here, same reasoning as renames and
`updatePortCount`.

**Entry is a picker against the project-wide Key catalog, not free text.**
The app already models keys via `Key {id: number; name: string}`
(`shared/types/key-configurator-config.types.ts`), sourced project-wide via
the existing `getAllKeyDefinitions` call used by the CKV/TKV panel. REQ-071
assignment reuses that same catalog and picker pattern rather than
introducing free-form text entry — `Subsystem.filteredKeys` holds `Key.id`
values (stringified) selected from that list, keeping this Keys-assignment
surface consistent with every other Key-typed UI in the app.

---

## MDF Exclusion

**REQ-054.** KV assignment is unavailable for MDF-type subgraphs — the Key
Configurator panel must not render KV options when the selected subgraph
is MDF. **MDF-ness is computed by the UI from module composition, not
read from any backend field.** An earlier draft of this document assumed
a `subgraphType`/`deviceType` field carried an `'MDF'` value — it does
not: the real `SubgraphDto.deviceType` enum is `Stream`/`Device`/
`Stream_Device`/`Stream_PP`/`Device_PP`, none of which mean MDF, and the
backend has no concept of MDF as a subgraph property at all. A subgraph
is MDF if and only if it contains exactly two modules, the IPC bridge
pair — `moduleId` `0x7001184` (IPC_TX) and `0x7001185` (IPC_RX) — and
nothing else:

```typescript
const IPC_TX_MODULE_ID = 0x7001184;
const IPC_RX_MODULE_ID = 0x7001185;

function isMdfSubgraph(subgraphId: string, moduleInstances: Record<string, ModuleInstance>): boolean {
  const members = Object.values(moduleInstances).filter((m) => m.subgraphId === subgraphId);
  return (
    members.length === 2 &&
    members.some((m) => m.moduleId === IPC_TX_MODULE_ID) &&
    members.some((m) => m.moduleId === IPC_RX_MODULE_ID)
  );
}
```

**This is a pure selector, computed fresh from `GraphDataSlice.moduleInstances`
every time the panel renders — nothing about it is cached or stamped onto
the derived `Subgraph` object.** Unlike `kvCasesById` (which genuinely
needs a session-local map because it holds user selections with no
source of truth to recompute from), MDF-ness has a source of truth that's
already sitting in `GraphDataSlice` at all times — recomputing it on
every read is exactly as cheap as reading a cached boolean would be, and
avoids yet another map to keep in sync across
`recomputeContainersAndSubgraphs` calls. `moduleId` for both IPC modules
is a fixed constant, not sourced from any project-specific catalog.

**An MDF subgraph still gets a `kvCasesById` entry, seeded the same way
as any other subgraph of its provenance — `isMdfSubgraph` only gates
*rendering*, not seeding.** This matters for Apply: `activeSubgraphs`
(`core-edit-session-design.md`) always includes one entry per subgraph on
canvas, with no MDF-specific omission logic anywhere in that payload
construction. Since `kvCasesById.get(subgraphId)` for an MDF subgraph is
simply whatever its normal seeding path produced — typically empty,
since nothing selects cases the panel never shows — the Apply-time
`valueSystemIds: []` for MDF subgraphs falls straight out of the existing
seed-once/never-omit mechanism; no separate MDF branch is needed in the
Apply payload construction at all.

---

## Open Items Inherited

- **API contract for CKV/TKV staging** — TBD with the backend team; the
  Key Configurator panel's existing `saveToBackend()` stubs (REQ-053,
  above) need real per-action endpoints that don't exist yet.
- **Subsystem Keys assignment (REQ-071) staging endpoint** — no confirmed
  home in the API at all; `assignSubsystemKey`/`unassignSubsystemKey`
  (above) are this design's own working shape, pending a real per-action
  endpoint from the backend team. This is now an open item about a
  real-time staging endpoint (matching CKV/TKV's treatment), not about an
  Apply-payload field — the earlier UI-only-until-Apply model (and its
  corresponding open item in `core-edit-session-design.md`) no longer
  applies. Subgraph KV assignment, by contrast, is now confirmed via
  `CreateUsecasesRequestDto`/`SubgraphKvSelectionDto` — no longer an open
  item for its own contract.
- **Whether every subsystem-bearing mutation response reliably carries an
  accurate `filteredKeys` on its `SubsystemDto`** — unconfirmed with the
  backend team. The Keys Assignment section above reads/writes
  `filteredKeys` directly on `GraphDataSlice`'s `Subsystem` node with no
  intermediate cache, which is only safe if every endpoint that can return
  a `SubsystemDto` in any bucket (`moveToSubsystem`, a `-with-subsystems`
  link create, a future subsystem port-count change) keeps that field
  current rather than omitting or staling it. If any of those endpoints'
  response DTOs don't recompute `filteredKeys`, its `upsertSubsystem` call
  would silently overwrite a just-confirmed Keys assignment.
- **Net-new single-subgraph-by-`systemId` endpoint for REQ-012's
  placement-time `SGKV` fetch** — TBD with the backend team; see
  `core-edit-session-design.md`'s Open Items for detail. `SGKV` itself is
  confirmed real on `SubgraphDto` (above) — what's missing is an endpoint
  shaped to fetch one subgraph by ID rather than every subgraph in the
  project.
- **Frontend `SubgraphDto` type needs updating to match the real
  schema** — `entities/subgraph-definitions/model/subgraph-definition.dto.ts`
  is stale (see `core-edit-session-design.md`'s Open Items for the full
  field diff); this blocks any code consuming `SGKV` or `deviceType`
  until fixed.
