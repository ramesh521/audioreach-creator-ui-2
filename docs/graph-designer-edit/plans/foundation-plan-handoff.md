# Plan Handoff: Usecase Designer Edit — Foundation Layer

**Spec:** `../design/core-edit-session-design.md` (primary), with two prerequisite
entity items pulled from `../design/canvas-ui-mechanics-design.md` and
`../design/kv-key-configuration-design.md` — see task notes below.
**Plan output:** `docs/graph-designer-edit/plans/foundation-plan.md`
**Scope note:** This is the **foundation plan only** — the universal
prerequisite layer that every other chapter of this feature depends on:
entity/type changes, the cross-project exclusive-lock store, `EditSessionSlice`
core state (mode machine, mutation lock, session-local bookkeeping maps), and
the `applyComponentCollection` response-reconciliation family.

**Explicitly out of scope for this plan** (separate follow-on plans, to be
planned once this foundation is real code, not spec):
- Apply Changes flow (`core-edit-session-design.md`'s Apply Changes section —
  LLD §6.1/§7.2, REQ-044–046)
- Discard/Rollback + project-close interception (`core-edit-session-design.md`'s
  Discard/Rollback section — REQ-061)
- All of `node-operations-design.md` (module/container/subgraph/subsystem CRUD)
- All of `link-and-port-design.md` (connections, port counts, DSP offload)
- All of `kv-key-configuration-design.md` beyond the one prerequisite type fix
  (KV assignment, CKV/TKV staging, Keys assignment)
- All of `canvas-ui-mechanics-design.md` beyond the one prerequisite type field
  (drag-and-drop, context menus, properties panel, multi-select/paste, port
  coloring UI)

Read `../requirements/graph-designer-edit-requirements.md` and
`../graph-designer-edit-lld.md` §2 (Architectural Impacts) and §6.1–6.3
(Component Design) for full context before planning. The LLD is the
synthesizing document; `core-edit-session-design.md` is the source of truth
for this plan's file-level detail.

## Batches

### Batch 1 (parallel)
- **Entity/type prerequisites** | Sections: `core-edit-session-design.md`
  Response Reconciliation section (`ComponentCollectionDto`/`ChangeInfoDto`
  and other new DTOs), `canvas-ui-mechanics-design.md` REQ-064/Port Coloring
  section (add `totalLinksAtPort: number` to the existing `Port` type in
  `graph-data-slice.ts`, and update every construction site —
  `loadGraphData`'s mapping — to populate it), `kv-key-configuration-design.md`
  §"SubgraphDto staleness" (fix
  `entities/subgraph-definitions/model/subgraph-definition.dto.ts` to declare
  `changeInfo`/`systemId`/`id`/`name`/`relatedEndPointLinks`/`scenarioType`/
  `deviceType`/`subGraphSharedType`/`SGKV`, and fix `subgraph-list-slice.ts`'s
  `toSubgraphDefinition` mapper to stop dropping these fields) | Start task 1
- **Global exclusive-lock store** | Section: `core-edit-session-design.md` §
  "Mode State & Exclusive Locking" (LLD §6.2) — `ExclusiveUsecaseMode` type,
  `GlobalStore.activeExclusiveModeByProject`, `setActiveExclusiveMode`,
  `releaseExclusiveMode`, in `shared/store/global-store.ts` | Start task 6

### Batch 2 (parallel, after batch 1)
- **EditSessionSlice core state & mode machine** | Section:
  `core-edit-session-design.md` §"Front-end store composition" (LLD §6.1) —
  `EditSessionSlice` interface, `mode`, `enterEditMode`/`exitEditMode`
  (including same-mode-twice rejection and reading the exclusive-lock store
  from batch 1), `isMutating`/`beginMutation`/`endMutation`,
  `usesSubsystemVariant`, `withMutationLock<T>()` wrapper (including its
  programming-error-vs-user-facing-failure throw semantics per LLD §11),
  composition into `GraphDesignerStore` | Start task 10
- **Session-local bookkeeping maps** | Section: `core-edit-session-design.md`
  §"Front-end store composition" — `subgraphProvenanceById`, `kvCasesById`,
  `pairLinksById`, `excludedLinks` field declarations on `EditSessionSlice`,
  plus the `mode === 'view'` clear-all-four block wired into
  `widgets/graph-designer/ui/graph-designer.tsx`'s existing "Effect A". Do
  NOT implement the KV-specific seeding logic itself
  (kv-key-configuration-design.md's `KvCase` construction) or the
  provenance-specific seeding logic (node-operations-design.md) — those
  belong to their own follow-on plans; this task only adds the empty maps,
  their declarations, and the clearing behavior on mode transition | Start
  task 18

### Batch 3 (sequential, after batch 2)
- **Response reconciliation (`applyComponentCollection` family)** | Section:
  `core-edit-session-design.md` §"Response reconciliation" (LLD §6.3) —
  `applyComponentCollection`, `applyAddedCollection`, `applyDeletedCollection`,
  `recomputeContainersAndSubgraphs`, `pruneDeletedLinkBookkeeping`,
  `upsertModule`/`removeModule`/`upsertLink`/`removeLink`/`upsertSubsystem`/
  `removeSubsystem` helpers, and `adjustSurvivingPortCounts`/
  `adjustPortForLink` (from `canvas-ui-mechanics-design.md`'s Port Coloring
  section — implement here since the reconciler is the only caller and it
  depends on batch 1's `totalLinksAtPort` field). This is the highest-fan-in
  piece of the foundation — every consumer chapter in every other design doc
  depends on it existing and behaving correctly for all three collection
  buckets (added/updated/deleted) across all entity kinds (modules, links,
  subsystems) | Start task 24

### Batch 4 (parallel, after batch 3)
- **Unit tests: EditSessionSlice + reconciler** | Covers
  `enterEditMode`/`exitEditMode` (lock acquire/release incl. same-mode-twice
  rejection), `beginMutation`/`endMutation`/`withMutationLock` throw
  semantics, `applyComponentCollection`/`recomputeContainersAndSubgraphs`
  upsert-vs-delete-per-bucket correctness, session-local map pruning on
  delete, `adjustSurvivingPortCounts` increment/decrement correctness on both
  create and cascading-delete paths | Start task 34
- **Integration tests: exclusive lock + mocked reconciliation round-trip** |
  Exclusive-lock behavior across two simulated Graph Designer tabs on the
  same `projectId` vs. two tabs on different projects; full mutation
  round-trip against a mocked three-collection backend response, verifying
  `GraphDataSlice` state post-merge for pure-create, pure-delete, and mixed
  cases | Start task 40
