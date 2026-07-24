# Usecase Designer Edit — Foundation Layer Implementation Plan

> **For agentic workers:** Use the executing-plans skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the universal foundation layer that every other chapter of the
Usecase Designer Edit feature depends on: entity/type prerequisites, the
cross-project exclusive-lock store, `EditSessionSlice` core state (mode
machine, mutation lock, session-local bookkeeping maps), and the
`applyComponentCollection` response-reconciliation family.

**Architecture:** See `docs/graph-designer-edit/graph-designer-edit-lld.md`
§2 (Architectural Impacts) and §6.1–6.3 (Component Design), and
`docs/graph-designer-edit/design/core-edit-session-design.md` for full
design detail. This plan implements only the foundation layer — it does not
implement Apply Changes, Discard, node/link/subsystem CRUD, KV/CKV/TKV/Keys
configuration, or canvas UI mechanics (drag-and-drop, context menus,
multi-select, copy/paste). Those are separate follow-on plans, scoped once
this foundation exists as real code.

**Tech Stack:** TypeScript, React, Zustand, Electron (desktop app), Jest/Vitest (per existing test conventions in `packages/react-app`).

**Note on task numbering and "sibling chapter" references:** this plan was
drafted as several chapter-local task ranges (entity/type prerequisites,
exclusive lock, `EditSessionSlice` core, session-local maps, response
reconciliation) and then consolidated into this single linear file. Some
chapter-local task numbers were dropped as redundant during consolidation,
so the numbering below is intentionally non-contiguous (gaps at 5, 15–17,
22–23, 27–29, 35–39 are expected, not missing tasks). Any remaining
reference below to a "sibling chapter," "parallel chapter," or an external
`chapters/*.md` file refers to a task range **within this same document**,
not a separate file — e.g. "the sibling chapter, tasks 10–17" means Tasks
10–14 below. Execute tasks in ascending numeric order; every dependency a
task lists on a "sibling chapter" is already satisfied by an earlier task
number in this file. Task 42 was added after review to close a gap the
original handoff scope missed: `core-edit-session-design.md`'s
`beforeunload` lock-release wiring in `editor-shell.tsx`.

---
### Task 1: Response-reconciliation DTOs — `ChangeInfoDto`'s sibling types

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/entities/usecases/model/usecase-component.dto.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`,
"Response reconciliation" section — `ComponentCollectionDto` (already
declared, unchanged) is the shape every mutating endpoint returns three of
(`addedComponentCollectionDto`/`updatedComponentCollectionDto`/
`deletedComponentCollectionDto`); this task adds the other DTOs that
section names as real API contracts: `SubgraphKvSelectionDto`,
`CreateUsecasesRequestDto`, `CreateUsecasesResponseDto`,
`DiscardChangesRequestDto`, `DiscardChangesResponseDto`. Only the type
declarations are added here — `applyComponentCollection`,
`applyChanges()`, `confirmDiscard()`, and every other function that
consumes them belong to later chapters (see
`docs/graph-designer-edit/plans/foundation-plan-handoff.md`'s Batch 2/3).

This is a type-only change — there is no runtime behavior to drive with a
failing test, so it is verified by `tsc` instead of `jest`.

- [ ] **Step 1: Add the new DTOs to `usecase-component.dto.ts`**

Append to the end of
`packages/react-app/src/entities/usecases/model/usecase-component.dto.ts`
(after the existing `ComponentCollectionDto` interface):

```typescript
export interface SubgraphKvSelectionDto {
  systemId: string; // subgraph's own systemId
  valueSystemIds: string[][]; // one inner array per SGKV *case*; each inner array is the value systemIds active in that case
}

export interface CreateUsecasesRequestDto {
  activeSubgraphs: SubgraphKvSelectionDto[];
  excludedControlLinkSystemIds?: string[];
  excludedDataLinkSystemIds?: string[];
  selectedUsecaseSystemIds: string[];
}

export interface ApiIssueItem {
  category?: string;
  code: string;
  impactedEntity?: string;
  impactedUsecases?: string[];
  message: string;
  severity: 'ERROR' | 'FATAL' | 'WARNING';
}

export interface CreateUsecasesResponseDto {
  created: UsecaseIdentifierDto[];
  deleted: UsecaseIdentifierDto[];
  issues: ApiIssueItem[];
  updated: UsecaseIdentifierDto[];
}

export interface DiscardChangesRequestDto {
  changeIds?: string[]; // omitted or empty = discard every change
}

export interface DiscardChangesResponseDto {
  cascadedChangeIds: string[]; // dependent changes discarded automatically
  failedChangeIds: string[];
  message: string;
  processedChangeIds: string[];
  success: boolean;
}
```

Key ordering within each interface is alphabetical, matching this file's
existing interfaces (`DataPortDto`, `SpfModuleDto`, etc.) and this repo's
ESLint `sortKeys` rule. `ApiIssueItem` is declared here (not imported from
elsewhere) since no shared "API issue" type exists yet anywhere in
`packages/react-app/src` — confirmed by search; `CreateUsecasesResponseDto`
is its only consumer today.

- [ ] **Step 2: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS (no errors) — the new interfaces aren't referenced by any
implementation yet, so this only confirms the additions are syntactically
and structurally valid TypeScript, and that `UsecaseIdentifierDto` (used
in `CreateUsecasesResponseDto`, already declared earlier in this same
file) resolves correctly.

- [ ] **Step 3: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/entities/usecases/model/usecase-component.dto.ts
  git commit -m "feat(react): add Apply/Discard DTOs to usecases entity" \
             -m "SubgraphKvSelectionDto, CreateUsecasesRequestDto," \
             -m "CreateUsecasesResponseDto, ApiIssueItem," \
             -m "DiscardChangesRequestDto, and DiscardChangesResponseDto —" \
             -m "the real createUsecases/discardChanges API contracts" \
             -m "core-edit-session-design.md's Response Reconciliation" \
             -m "section documents. Type declarations only; the reconciler" \
             -m "and applyChanges/confirmDiscard functions that consume" \
             -m "them are later chapters." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 2: `totalLinksAtPort` on the runtime `Port` type

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`

**Spec:** `docs/graph-designer-edit/design/canvas-ui-mechanics-design.md`,
"Port Coloring" section (REQ-064). The *runtime* `Port` type in
`graph-data-slice.ts` (`{direction, isStatic, portId, portName, portType}`,
used by `ModuleInstance.inputPorts`/`outputPorts`) is the one this task
modifies — **not** the unrelated `Port` in
`entities/graph/model/graph.types.ts` (`portIoType`/`maxConnections`/
`locked`, belonging to the Visualizer's own rendering layer), which the
design doc explicitly calls out as a different type never touched by this
feature.

`DataPortDto.totalLinksAtPort` already exists on the backend DTO
(`entities/usecases/model/usecase-component.dto.ts`, confirmed present)
but the runtime `Port` type drops it — this task closes that gap for data
ports. `ControlPortDto` (the DTO backing the `Port` objects built from
`m.controlPorts`/`ss.controlPorts`) has no `totalLinksAtPort` field at
all, consistent with REQ-064 being a data-port-driven coloring rule (the
"Data source" paragraph of the Port Coloring section cites only
`DataPortDto.totalLinksAtPort`) — so control-port-derived `Port` objects
get the field defaulted to `0` at construction, never copied from a DTO
field that doesn't exist.

This is a type-only change plus its construction-site updates — there is
no new branching logic to drive with a failing test (the later
increment/decrement logic in `adjustSurvivingPortCounts` is a different
chapter, per `foundation-plan-handoff.md`'s Batch 3), so it is verified by
`tsc` plus the existing `graph-data-slice.test.ts` suite rather than a new
test file.

- [ ] **Step 1: Add `totalLinksAtPort` to the `Port` interface**

In `packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`,
modify the existing `Port` interface (around line 16):

```typescript
export interface Port {
  direction: 'input' | 'output';
  isStatic: boolean;
  portId: string;
  portName: string;
  portType: 'control' | 'data';
  totalLinksAtPort: number;
}
```

- [ ] **Step 2: Populate the field at every module-port construction site in `loadGraphData`**

In the same file, the module-mapping loop inside `loadGraphData` builds
three `Port[]` arrays from `m.dataPorts`/`m.controlPorts`. Update each of
the three object-literal mappings (around lines 224–249) to add
`totalLinksAtPort`:

```typescript
const inputPorts: Port[] = (m.dataPorts ?? [])
  .filter((p) => p.portIoType === 'Input')
  .map((p) => ({
    direction: 'input' as const,
    isStatic: p.portType === 'Static',
    portId: p.systemId,
    portName: p.name,
    portType: 'data' as const,
    totalLinksAtPort: p.totalLinksAtPort,
  }));
const controlPorts: Port[] = (m.controlPorts ?? []).map((p) => ({
  direction: 'input' as const,
  isStatic: p.portType === 'Static',
  portId: p.systemId,
  portName: p.controlPortName,
  portType: 'control' as const,
  totalLinksAtPort: 0, // ControlPortDto has no totalLinksAtPort field — REQ-064 coloring is data-port-only
}));
const outputPorts: Port[] = (m.dataPorts ?? [])
  .filter((p) => p.portIoType === 'Output')
  .map((p) => ({
    direction: 'output' as const,
    isStatic: p.portType === 'Static',
    portId: p.systemId,
    portName: p.name,
    portType: 'data' as const,
    totalLinksAtPort: p.totalLinksAtPort,
  }));
```

- [ ] **Step 3: Populate the field at the subsystem-port construction site in `loadGraphData`**

The same function separately builds `SubsystemPort[]` (not `Port[]`) for
`Subsystem.controlPorts`/`dataPorts` (around lines 311–322) — this is a
distinct interface REQ-064 explicitly excludes ("subsystem ports are
explicitly out of scope"), so it is **not** modified by this task; leave
`SubsystemPort` and its construction site untouched.

- [ ] **Step 4: Run the existing graph-data-slice tests to verify nothing broke**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: PASS, all existing tests green — the added field is additive
and none of the current assertions inspect port shape, but this confirms
the mapping loop still runs end-to-end with real fixture DTOs (`minimalDto`,
`dtoWithSubsystem`) that omit `totalLinksAtPort` (verifying `p.totalLinksAtPort`
resolves to `undefined` rather than throwing when a fixture DTO doesn't
set it — acceptable for this prerequisite task since the fixtures predate
this field; a later chapter's tests will assert the value itself).

- [ ] **Step 5: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 6: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/graph-data-slice.ts
  git commit -m "feat(react): thread totalLinksAtPort onto runtime Port" \
             -m "Adds totalLinksAtPort to graph-data-slice.ts's Port type" \
             -m "and populates it from DataPortDto at loadGraphData's" \
             -m "module-port mapping sites (defaulted to 0 for control" \
             -m "ports, which have no such backend field). Prerequisite" \
             -m "for REQ-064 port coloring, canvas-ui-mechanics-design.md;" \
             -m "the increment/decrement-on-link-change logic is a" \
             -m "separate follow-on chapter." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 3: Correct the stale `SubgraphDto` type

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/entities/subgraph-definitions/model/subgraph-definition.dto.ts`

**Spec:** `docs/graph-designer-edit/design/kv-key-configuration-design.md`,
"KV Assignment — Existing Subgraphs" section (REQ-039), and
`core-edit-session-design.md`'s Open Items ("The frontend `SubgraphDto`
type is stale against the real schema and needs updating"). The current
type only declares `description`/`name`/`subgraphId`/`subgraphType`
against a real backend schema of `changeInfo`/`systemId`/`id`/`name`/
`relatedEndPointLinks`/`scenarioType`/`deviceType`/`subGraphSharedType`/
`SGKV` — there is no `subgraphType` field on the real DTO at all (the
stale type's `subgraphType` is what the real schema calls `deviceType`).
This task fixes only the type declaration; Task 4 fixes the mapper that
consumes it.

`ChangeInfoDto` and `KeyValueInfo`/`KeyInfo`/`ValueInfo` (which
`KeyValuePairsInfo`'s `keyValueCollection` field is built from) already
exist in `entities/usecases/model/usecase-component.dto.ts` — this task
imports them rather than redeclaring duplicates, since both DTOs describe
the same backend `changeInfo` shape and the same Key/Value pair shape.

This is a type-only change — verified by `tsc`, not `jest`.

- [ ] **Step 1: Replace the stale `SubgraphDto` and add `KeyValuePairsInfo`**

Replace the full contents of
`packages/react-app/src/entities/subgraph-definitions/model/subgraph-definition.dto.ts`:

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {
  ChangeInfoDto,
  EndPointLink,
  KeyValueInfo,
} from '~entities/usecases/model/usecase-component.dto';

/**
 * One selectable KV case a subgraph supports — a whole combination of
 * Key+Value pairs offered as a unit, not individually toggleable.
 */
export interface KeyValuePairsInfo {
  keyValueCollection: KeyValueInfo[];
  systemId: string;
}

/**
 * Subgraph data transfer object, as returned by `getAllSubgraphs(projectId)`.
 */
export interface SubgraphDto {
  changeInfo: ChangeInfoDto;
  deviceType: 'Device' | 'Device_PP' | 'Stream' | 'Stream_Device' | 'Stream_PP';
  id: number;
  name: string;
  relatedEndPointLinks: EndPointLink[];
  scenarioType: 'Audio' | 'Voice';
  SGKV: KeyValuePairsInfo[];
  subGraphSharedType: string;
  subgraphId: number;
  systemId: string;
}
```

`subgraphId` is retained (it is real and already used throughout the
codebase — e.g. `subgraph-list-slice.ts`'s `toSubgraphDefinition`,
`subgraph-list.tsx`'s list rendering — and the design doc's field diff
never says to remove it, only that `subgraphType` doesn't exist);
`description` is dropped since the design doc's real-schema field list
does not include it and no current consumer reads `SubgraphDto.description`
outside `toSubgraphDefinition` (fixed in Task 4). `subGraphSharedType` is
typed as `string` since neither design doc gives its enum values, unlike
`scenarioType`/`deviceType` which do.

- [ ] **Step 2: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: This will surface every existing consumer of the now-removed
`SubgraphDto.subgraphType`/`description` fields as a compile error — this
is expected and by design (the doc calls this "a real prerequisite code
change," not a docs-only fix). Do not fix those errors in this task; note
each file/line surfaced and hand it to Task 4, whose scope covers
`subgraph-list-slice.ts`'s mapper. If `tsc` surfaces errors outside
`subgraph-list-slice.ts` (e.g. `subgraph-list.tsx`, `subgraph-list-types.ts`),
flag them to the session assembling the full plan — they are consumers
this chapter's stated scope (mapper-only) does not cover, and belong to
whichever later chapter first needs `SubgraphDto.deviceType`/`SGKV` live
on canvas.

- [ ] **Step 3: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/entities/subgraph-definitions/model/subgraph-definition.dto.ts
  git commit -m "fix(react): correct stale SubgraphDto to real schema" \
             -m "The type declared description/name/subgraphId/subgraphType" \
             -m "against a real backend schema of changeInfo/systemId/id/" \
             -m "name/relatedEndPointLinks/scenarioType/deviceType/" \
             -m "subGraphSharedType/SGKV — subgraphType never existed on" \
             -m "the real DTO. Adds KeyValuePairsInfo for SGKV's element" \
             -m "type. Blocks REQ-039's KV work per" \
             -m "kv-key-configuration-design.md; known consumer breakage" \
             -m "is fixed in the following mapper-update task." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 4: Carry the corrected fields through `toSubgraphDefinition`

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/features/graph-designer/model/subgraph-list-slice.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s
Open Items: "`subgraph-list-slice.ts`'s `toSubgraphDefinition` mapper …
currently drops every field outside the stale four." With Task 3's
`SubgraphDto` now correct, this mapper must carry the new fields onto the
`SubgraphDefinition` frontend model instead of dropping them, and stop
reading the now-removed `dto.subgraphType`/`dto.description`.

This task only fixes the mapper and its immediate type — it does not seed
`EditSessionSlice.kvCasesById` from `SGKV` (that is
`kv-key-configuration-design.md`'s own KV-assignment chapter, explicitly
out of scope per `foundation-plan-handoff.md`).

- [ ] **Step 1: Extend `SubgraphDefinition` with the new fields**

In `packages/react-app/src/features/graph-designer/model/subgraph-list-slice.ts`,
modify the `SubgraphDefinition` interface:

```typescript
export interface SubgraphDefinition {
  category: string;
  changeInfo: ChangeInfoDto;
  deviceType: SubgraphDto['deviceType'];
  scenarioType: SubgraphDto['scenarioType'];
  SGKV: KeyValuePairsInfo[];
  subGraphSharedType: string;
  subgraphId: string;
  subgraphName: string;
}
```

This drops `description`/`subgraphType` (no longer real fields, per Task
3) and adds the six real fields the design doc names, keyed under names
that match their `SubgraphDto` counterparts one-to-one except
`subgraphId`/`subgraphName` (kept as the existing frontend-facing names
for `systemId`/`name`, unchanged from before this task, to avoid a wider
rename across every current consumer such as `subgraph-list.tsx`).
`category` is retained as-is (already always `''`, unrelated to this
fix).

- [ ] **Step 2: Update the imports**

At the top of the same file, change:

```typescript
import {
  getAllSubgraphs,
  type SubgraphDto,
} from '~entities/subgraph-definitions';
```

to:

```typescript
import {
  getAllSubgraphs,
  type KeyValuePairsInfo,
  type SubgraphDto,
} from '~entities/subgraph-definitions';
import type {ChangeInfoDto} from '~entities/usecases/model/usecase-component.dto';
```

This requires `entities/subgraph-definitions/index.ts` to also export
`KeyValuePairsInfo` — add it alongside the existing `SubgraphDto` export:

```typescript
export {getAllSubgraphs} from './api/subgraph-definition-api';
export type {
  KeyValuePairsInfo,
  SubgraphDto,
} from './model/subgraph-definition.dto';
```

- [ ] **Step 3: Update `toSubgraphDefinition` to carry the fields through**

In the same `subgraph-list-slice.ts` file, replace `toSubgraphDefinition`:

```typescript
function toSubgraphDefinition(dto: SubgraphDto): SubgraphDefinition {
  return {
    category: '',
    changeInfo: dto.changeInfo,
    deviceType: dto.deviceType,
    scenarioType: dto.scenarioType,
    SGKV: dto.SGKV,
    subGraphSharedType: dto.subGraphSharedType,
    subgraphId: String(dto.subgraphId),
    subgraphName: dto.name,
  };
}
```

- [ ] **Step 4: Fix the one in-file consumer of the removed `subgraphType` field**

The same file's `loadSubgraphList` action computes
`allSubgraphTypes` from `subgraphs.map((s) => s.subgraphType)` — update it
to read the renamed field:

```typescript
const allSubgraphTypes = [
  ...new Set(subgraphs.map((s) => s.deviceType)),
].sort();
```

- [ ] **Step 5: Verify the project typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: The errors Task 3 introduced inside `subgraph-list-slice.ts`
(the only file this chapter's scope covers) are now resolved. Any
remaining errors are in files outside this chapter's named scope
(`subgraph-list.tsx`, `subgraph-list-types.ts`, or any other consumer of
`SubgraphDto.subgraphType`/`.description` surfaced by Task 3's Step 2) —
confirm the remaining error list matches what Task 3 flagged, and
hand that list to the session assembling the full plan rather than fixing
it here, since those consumers are not named in this chapter's scope
statement.

- [ ] **Step 6: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/subgraph-list-slice.ts \
          packages/react-app/src/entities/subgraph-definitions/index.ts
  git commit -m "fix(react): stop dropping fields in toSubgraphDefinition" \
             -m "SubgraphDefinition and its mapper now carry changeInfo/" \
             -m "deviceType/scenarioType/SGKV/subGraphSharedType through" \
             -m "from the corrected SubgraphDto instead of discarding" \
             -m "them, and read deviceType (not the removed subgraphType)" \
             -m "for the palette's type-filter list. Unblocks REQ-039's" \
             -m "KV work per kv-key-configuration-design.md." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.
### Task 6: `ExclusiveUsecaseMode` type and `GlobalStore` interface additions

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/shared/store/global-store.types.ts`

This task only adds type declarations — there is no runtime behavior to
drive with a failing test, so it is verified by `tsc` instead of `jest`
(the actions themselves, and their test coverage, are Task 7/8).

- [ ] **Step 1: Add the `ExclusiveUsecaseMode` type and `ExclusiveLockSlice` interface**

Append to the end of
`packages/react-app/src/shared/store/global-store.types.ts` (alongside the
existing `AppSlice`/`RecentProjectsSlice`/etc. interfaces already in this
file):

```typescript
export type ExclusiveUsecaseMode =
  | 'diff-merge'
  | 'discovery-wizard'
  | 'none'
  | 'usecase-edit';

export interface ExclusiveLockSlice {
  activeExclusiveModeByProject: Record<string, ExclusiveUsecaseMode>;
  /** Returns `false` if the lock for this project is already held by *any*
   *  mode — including a second attempt to acquire the *same* mode again.
   *  Each of Usecase Edit, Discovery Wizard, and Diff/Merge is a
   *  single-instance-per-project feature. */
  releaseExclusiveMode: (
    projectId: string,
    mode: ExclusiveUsecaseMode,
  ) => void;
  /** Only clears the lock if `mode` is the value currently held for this
   *  project — guards against a stale unmount releasing a lock a newer
   *  instance acquired. */
  setActiveExclusiveMode: (
    projectId: string,
    mode: ExclusiveUsecaseMode,
  ) => boolean;
}
```

Key ordering here (`activeExclusiveModeByProject`, `releaseExclusiveMode`,
`setActiveExclusiveMode`) is alphabetical to satisfy this repo's ESLint
`sortKeys` rule — do not reorder to match the LLD's own (non-alphabetical)
prose ordering.

- [ ] **Step 2: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS (no errors) — the new type/interface aren't referenced by
any implementation yet, so this only confirms the additions themselves are
syntactically and structurally valid TypeScript.

- [ ] **Step 3: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/shared/store/global-store.types.ts
  git commit -m "feat(react): add exclusive-lock types to global store" \
             -m "Adds ExclusiveUsecaseMode and ExclusiveLockSlice, the" \
             -m "type-level foundation for the cross-project exclusive" \
             -m "lock Usecase Edit/Discovery Wizard/Diff-Merge will share." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 7: Failing tests for `createExclusiveLockSlice`

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/tests/shared/store/exclusive-lock-slice.test.ts`

This test file drives Task 8's implementation. It imports a slice factory
(`createExclusiveLockSlice`) that does not exist yet — the test file itself
will fail to compile/run until Task 8 creates it, which is the "RED" step
of this task's TDD cycle.

- [ ] **Step 1: Write the failing test**

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import {createStore} from 'zustand';

import {createExclusiveLockSlice} from '~shared/store/global-store-slices/exclusive-lock-slice';
import type {ExclusiveLockSlice} from '~shared/store/global-store.types';

function makeStore() {
  return createStore<ExclusiveLockSlice>((set, get) =>
    createExclusiveLockSlice(set, get),
  );
}

describe('createExclusiveLockSlice', () => {
  it('acquires the lock for a project with no active mode', () => {
    const store = makeStore();

    const acquired = store
      .getState()
      .setActiveExclusiveMode('proj-1', 'usecase-edit');

    expect(acquired).toBe(true);
    expect(store.getState().activeExclusiveModeByProject['proj-1']).toBe(
      'usecase-edit',
    );
  });

  it('rejects a second acquisition of the same mode for the same project', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');

    const acquired = store
      .getState()
      .setActiveExclusiveMode('proj-1', 'usecase-edit');

    expect(acquired).toBe(false);
    expect(store.getState().activeExclusiveModeByProject['proj-1']).toBe(
      'usecase-edit',
    );
  });

  it('rejects acquisition of a different mode while one is already held', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'discovery-wizard');

    const acquired = store
      .getState()
      .setActiveExclusiveMode('proj-1', 'usecase-edit');

    expect(acquired).toBe(false);
    expect(store.getState().activeExclusiveModeByProject['proj-1']).toBe(
      'discovery-wizard',
    );
  });

  it('does not let one project`s lock block a different project', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');

    const acquired = store
      .getState()
      .setActiveExclusiveMode('proj-2', 'usecase-edit');

    expect(acquired).toBe(true);
    expect(store.getState().activeExclusiveModeByProject['proj-1']).toBe(
      'usecase-edit',
    );
    expect(store.getState().activeExclusiveModeByProject['proj-2']).toBe(
      'usecase-edit',
    );
  });

  it('releases the lock when the released mode matches the currently held mode', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');

    store.getState().releaseExclusiveMode('proj-1', 'usecase-edit');

    expect(
      store.getState().activeExclusiveModeByProject['proj-1'],
    ).toBeUndefined();
  });

  it('does not release the lock when the released mode does not match the held mode', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');

    store.getState().releaseExclusiveMode('proj-1', 'discovery-wizard');

    expect(store.getState().activeExclusiveModeByProject['proj-1']).toBe(
      'usecase-edit',
    );
  });

  it('is a no-op when releasing a lock that is not held at all', () => {
    const store = makeStore();

    expect(() =>
      store.getState().releaseExclusiveMode('proj-1', 'usecase-edit'),
    ).not.toThrow();
    expect(
      store.getState().activeExclusiveModeByProject['proj-1'],
    ).toBeUndefined();
  });

  it('allows re-acquiring the same mode for the same project after release', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');
    store.getState().releaseExclusiveMode('proj-1', 'usecase-edit');

    const acquired = store
      .getState()
      .setActiveExclusiveMode('proj-1', 'usecase-edit');

    expect(acquired).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/shared/store/exclusive-lock-slice.test.ts"`
Expected: FAIL with a module-not-found error, e.g. `Cannot find module
'~shared/store/global-store-slices/exclusive-lock-slice' from
'tests/shared/store/exclusive-lock-slice.test.ts'` — the slice file does
not exist yet.

- [ ] **Step 3: Commit the test file**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/tests/shared/store/exclusive-lock-slice.test.ts
  git commit -m "test(react): add failing tests for exclusive-lock slice" \
             -m "Covers acquire/reject/release semantics for the" \
             -m "cross-project exclusive-mode lock: same-mode-twice" \
             -m "rejection, different-mode rejection, cross-project" \
             -m "isolation, and the release-only-if-matching guard." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 8: Implement `createExclusiveLockSlice` to make Task 7's tests pass

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/src/shared/store/global-store-slices/exclusive-lock-slice.ts`
- Test: `packages/react-app/tests/shared/store/exclusive-lock-slice.test.ts` (from Task 7, unchanged)

- [ ] **Step 1: Write the minimal implementation**

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {logger} from '~shared/lib/logger';

import type {
  ExclusiveLockSlice,
  ExclusiveUsecaseMode,
} from '../global-store.types';

export function createExclusiveLockSlice(
  set: (partial: Partial<ExclusiveLockSlice>) => void,
  get: () => ExclusiveLockSlice,
): ExclusiveLockSlice {
  return {
    activeExclusiveModeByProject: {},

    releaseExclusiveMode: (
      projectId: string,
      mode: ExclusiveUsecaseMode,
    ): void => {
      const current = get().activeExclusiveModeByProject[projectId] ?? 'none';
      if (current !== mode) {
        return;
      }

      const next = {...get().activeExclusiveModeByProject};
      delete next[projectId];
      set({activeExclusiveModeByProject: next});

      logger.debug('Exclusive mode released', {
        action: 'release_exclusive_mode',
        component: 'ExclusiveLockSlice',
        mode,
        projectId,
      });
    },

    setActiveExclusiveMode: (
      projectId: string,
      mode: ExclusiveUsecaseMode,
    ): boolean => {
      const current = get().activeExclusiveModeByProject[projectId] ?? 'none';
      if (current !== 'none') {
        logger.debug('Exclusive mode acquisition rejected', {
          action: 'set_active_exclusive_mode',
          component: 'ExclusiveLockSlice',
          currentMode: current,
          projectId,
          requestedMode: mode,
        });
        return false;
      }

      set({
        activeExclusiveModeByProject: {
          ...get().activeExclusiveModeByProject,
          [projectId]: mode,
        },
      });

      logger.debug('Exclusive mode acquired', {
        action: 'set_active_exclusive_mode',
        component: 'ExclusiveLockSlice',
        mode,
        projectId,
      });
      return true;
    },
  };
}
```

Note the rejection check is `current !== 'none'`, not `current !== mode &&
current !== 'none'` — this is what makes re-acquiring the *same* mode also
fail (REQ-060/062's "single-instance-per-project, including against
itself" requirement); a narrower check that only compared against a
*different* mode would silently let a second same-project tab acquire a
second `'usecase-edit'` lock, which is the exact bug the design doc calls
out as an earlier draft's mistake.

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/shared/store/exclusive-lock-slice.test.ts"`
Expected: PASS, all 8 tests green.

- [ ] **Step 3: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/shared/store/global-store-slices/exclusive-lock-slice.ts
  git commit -m "feat(react): implement exclusive-lock slice actions" \
             -m "setActiveExclusiveMode/releaseExclusiveMode implement" \
             -m "the per-project cross-cutting lock Usecase Edit," \
             -m "Discovery Wizard, and Diff/Merge will share via" \
             -m "shared/store/global-store.ts (FSD forbids Usecase Edit" \
             -m "importing the other two features directly)." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 9: Wire the slice into `GlobalStore` and verify selector reactivity

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/shared/store/global-store.ts`
- Create: `packages/react-app/tests/shared/store/global-store.test.ts`

This is the integration point: Task 8 proved the slice's logic works in
isolation; this task proves it is actually reachable from `useGlobalStore`
(the hook every real caller — the "Start Usecase Modification" button
selector, the Discovery Wizard menu entry, a future Diff/Merge mount
`useEffect` — will use) and that a project-scoped selector reacts the way
LLD §13 requires (no polling, no manual event wiring; a component
subscribed to one project's lock is unaffected by another project's lock
changing).

- [ ] **Step 1: Write the failing test**

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import {act, renderHook} from '@testing-library/react';

import {useGlobalStore} from '~shared/store/global-store';

describe('useGlobalStore — exclusive lock wiring', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('exposes setActiveExclusiveMode/releaseExclusiveMode on the composed store', () => {
    const acquired = useGlobalStore
      .getState()
      .setActiveExclusiveMode('proj-1', 'usecase-edit');

    expect(acquired).toBe(true);
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-1'],
    ).toBe('usecase-edit');

    useGlobalStore.getState().releaseExclusiveMode('proj-1', 'usecase-edit');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-1'],
    ).toBeUndefined();
  });

  it('reacts a project-scoped selector when that project`s lock changes', () => {
    const {result} = renderHook(() =>
      useGlobalStore((s) => s.activeExclusiveModeByProject['proj-1'] ?? 'none'),
    );
    expect(result.current).toBe('none');

    act(() => {
      useGlobalStore.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');
    });

    expect(result.current).toBe('usecase-edit');
  });

  it('does not change a project-1 selector when project-2`s lock changes', () => {
    const {result} = renderHook(() =>
      useGlobalStore((s) => s.activeExclusiveModeByProject['proj-1'] ?? 'none'),
    );

    act(() => {
      useGlobalStore
        .getState()
        .setActiveExclusiveMode('proj-2', 'discovery-wizard');
    });

    expect(result.current).toBe('none');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/shared/store/global-store.test.ts"`
Expected: FAIL — `useGlobalStore.getState().setActiveExclusiveMode is not a
function` (the slice isn't composed into `GlobalStore` yet).

- [ ] **Step 3: Wire `createExclusiveLockSlice` into `global-store.ts`**

Modify `packages/react-app/src/shared/store/global-store.ts`:

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {create} from 'zustand';

import {createAppSlice} from './global-store-slices/app-slice';
import {createBackendConnectionSlice} from './global-store-slices/backend-connection-slice';
import {createExclusiveLockSlice} from './global-store-slices/exclusive-lock-slice';
import {createProjectGroupSlice} from './global-store-slices/project-group-slice';
import {createRecentProjectsSlice} from './global-store-slices/recent-projects-slice';
import {createSessionSlice} from './global-store-slices/session-slice';
import type {
  AppSlice,
  BackendConnectionSlice,
  ExclusiveLockSlice,
  ProjectGroupSlice,
  RecentProjectsSlice,
  SessionSlice,
} from './global-store.types';

export type GlobalStore = AppSlice &
  BackendConnectionSlice &
  ExclusiveLockSlice &
  RecentProjectsSlice &
  SessionSlice &
  ProjectGroupSlice;

export const useGlobalStore = create<GlobalStore>((set, get) => ({
  ...createAppSlice(
    (partial) => set(partial as Partial<GlobalStore>),
    () => get() as AppSlice,
  ),
  ...createBackendConnectionSlice(
    (partial) => set(partial as Partial<GlobalStore>),
    () => get() as BackendConnectionSlice,
  ),
  ...createExclusiveLockSlice(
    (partial) => set(partial as Partial<GlobalStore>),
    () => get() as ExclusiveLockSlice,
  ),
  ...createRecentProjectsSlice(
    (partial) => set(partial as Partial<GlobalStore>),
    () => get() as RecentProjectsSlice,
  ),
  ...createSessionSlice(
    (partial) => set(partial as Partial<GlobalStore>),
    () => get() as SessionSlice,
  ),
  ...createProjectGroupSlice(
    (partial) => set(partial as Partial<GlobalStore>),
    () => get() as ProjectGroupSlice,
    () => get() as AppSlice,
  ),
}));
```

Only three changes from the existing file: the new import, the new
`ExclusiveLockSlice` entry in both the `import type` list and the
`GlobalStore` intersection, and the new `...createExclusiveLockSlice(...)`
spread — every other slice's wiring is unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/shared/store/global-store.test.ts"`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/shared/store/global-store.ts \
          packages/react-app/tests/shared/store/global-store.test.ts
  git commit -m "feat(react): wire exclusive-lock slice into global store" \
             -m "Composes ExclusiveLockSlice into GlobalStore so any" \
             -m "component (Start Usecase Modification button, Discovery" \
             -m "Wizard menu entry, a future Diff/Merge mount effect) can" \
             -m "acquire/release the per-project lock via useGlobalStore." \
             -m "Verifies project-scoped selector isolation: one" \
             -m "project's lock change does not affect another's." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.
### Task 10: Failing tests for `createEditSessionSlice` — mode, exclusive lock, mutation-lock flag

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/tests/features/graph-designer/edit-session-slice.test.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`, "Mode
State & Exclusive Locking" and "Per-Operation Loading State" sections; LLD
§6.1 "Front-end store composition" and §14 "Testing Strategy" (`EditSessionSlice`
actions in isolation: `enterEditMode`/`exitEditMode` lock acquire/release
including same-mode-twice rejection, `beginMutation`/`endMutation`). This
task covers the `mode`/`enterEditMode`/`exitEditMode`/`isMutating`/
`beginMutation`/`endMutation`/`usesSubsystemVariant` members only —
`applyStatus`/`modificationSummary`/`applyChanges`/`discardConfirmationOpen`/
`requestDiscard`/`confirmDiscard`/`cancelDiscard`/`subgraphProvenanceById`/
`kvCasesById`/`pairLinksById`/`excludedLinks` belong to later chapters and
are not part of this file. `withMutationLock` is covered separately in Task
12, not here.

This task depends on `createExclusiveLockSlice`/`ExclusiveUsecaseMode` being
composed into `useGlobalStore` (Tasks 6–9 above) —
`enterEditMode()`/`exitEditMode()` call
`useGlobalStore.getState().setActiveExclusiveMode`/`releaseExclusiveMode`
directly, the same real per-project lock, not a mock. This test file imports
a slice factory (`createEditSessionSlice`) that does not exist yet — it will
fail to compile/run until Task 11 creates it, which is the "RED" step of
this task's TDD cycle.

- [ ] **Step 1: Write the failing test**

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import {createStore} from 'zustand';

import {
  createEditSessionSlice,
  type EditSessionSlice,
} from '~features/graph-designer/model/edit-session-slice';
import {useGlobalStore} from '~shared/store/global-store';

function makeStore(projectId: string) {
  return createStore<EditSessionSlice>((set) =>
    createEditSessionSlice(set, projectId),
  );
}

describe('createEditSessionSlice — mode & exclusive lock', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('enters edit mode and acquires the exclusive lock when no lock is held', () => {
    const store = makeStore('proj-edit-1');

    const acquired = store.getState().enterEditMode();

    expect(acquired).toBe(true);
    expect(store.getState().mode).toBe('edit');
    expect(store.getState().usesSubsystemVariant).toBe(true);
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-edit-1'],
    ).toBe('usecase-edit');
  });

  it('fails to enter edit mode and stays in view mode when the lock is already held', () => {
    useGlobalStore
      .getState()
      .setActiveExclusiveMode('proj-edit-2', 'discovery-wizard');
    const store = makeStore('proj-edit-2');

    const acquired = store.getState().enterEditMode();

    expect(acquired).toBe(false);
    expect(store.getState().mode).toBe('view');
  });

  it('rejects a second enterEditMode() call without an intervening exitEditMode()', () => {
    const store = makeStore('proj-edit-3');

    const first = store.getState().enterEditMode();
    const second = store.getState().enterEditMode();

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(store.getState().mode).toBe('edit');
  });

  it('exitEditMode() releases the lock and returns to view mode', () => {
    const store = makeStore('proj-edit-4');
    store.getState().enterEditMode();

    store.getState().exitEditMode();

    expect(store.getState().mode).toBe('view');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-edit-4'],
    ).toBeUndefined();
  });

  it('allows re-entering edit mode for the same project after exitEditMode()', () => {
    const store = makeStore('proj-edit-5');
    store.getState().enterEditMode();
    store.getState().exitEditMode();

    const acquired = store.getState().enterEditMode();

    expect(acquired).toBe(true);
    expect(store.getState().mode).toBe('edit');
  });
});

describe('createEditSessionSlice — mutation lock flag', () => {
  it('starts with isMutating false and mode view', () => {
    const store = makeStore('proj-mut-1');

    expect(store.getState().isMutating).toBe(false);
    expect(store.getState().mode).toBe('view');
  });

  it('beginMutation() sets isMutating to true', () => {
    const store = makeStore('proj-mut-2');

    store.getState().beginMutation();

    expect(store.getState().isMutating).toBe(true);
  });

  it('endMutation() sets isMutating to false', () => {
    const store = makeStore('proj-mut-3');
    store.getState().beginMutation();

    store.getState().endMutation();

    expect(store.getState().isMutating).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/edit-session-slice.test.ts"`
Expected: FAIL with a module-not-found/no-exported-member error, e.g.
`Cannot find module '~features/graph-designer/model/edit-session-slice'
from 'tests/features/graph-designer/edit-session-slice.test.ts'` — the
slice file does not exist yet.

- [ ] **Step 3: Commit the test file**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/tests/features/graph-designer/edit-session-slice.test.ts
  git commit -m "test(react): add failing tests for EditSessionSlice core" \
             -m "Covers mode/enterEditMode/exitEditMode against the real" \
             -m "cross-project exclusive lock (success, lock-unavailable" \
             -m "failure, same-mode-twice rejection, release-and-reenter)" \
             -m "and the isMutating/beginMutation/endMutation flag." \
             -m "Apply/Discard state and the session-local bookkeeping" \
             -m "maps are later chapters, not covered here." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 11: Implement `createEditSessionSlice` to make Task 10's tests pass

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/src/features/graph-designer/model/edit-session-slice.ts`
- Test: `packages/react-app/tests/features/graph-designer/edit-session-slice.test.ts` (from Task 10, unchanged)

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`,
"Mode State & Exclusive Locking" (`enterEditMode()` calls
`setActiveExclusiveMode(projectId, 'usecase-edit')`; `exitEditMode()` calls
`releaseExclusiveMode(projectId, 'usecase-edit')`) and "Endpoint variant …
chosen once per edit session" (`usesSubsystemVariant` set in
`enterEditMode()`). LLD §3 "Assumptions": the raw/subsystem display-mode
toggle this would otherwise read is a separate, not-yet-built feature — "if
it hasn't landed by ship time, the consuming hook is stubbed to always
return `'subsystem'`" — so `usesSubsystemVariant` is hardcoded `true` here
rather than reading a hook that doesn't exist in this codebase yet
(confirmed absent by search).

- [ ] **Step 1: Write the implementation**

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {StoreApi} from 'zustand';

import {logger} from '~shared/lib/logger';
import {useGlobalStore} from '~shared/store/global-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditSessionSlice {
  beginMutation: () => void;
  endMutation: () => void;
  /** Returns `false` if the cross-project exclusive lock is unavailable —
   *  `mode` stays `'view'` in that case. */
  enterEditMode: () => boolean;
  exitEditMode: () => void;
  /** Single serial mutation lock, REQ-065 — gates all canvas interaction
   *  for the duration of any one backend call. */
  isMutating: boolean;
  mode: 'view' | 'edit';
  /** Fixed for the lifetime of the edit session, set in `enterEditMode()`. */
  usesSubsystemVariant: boolean;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

/**
 * Creates the edit-session slice for composing into the Graph Designer tab
 * store. Holds session bookkeeping only (mode, exclusive lock, the single
 * serial mutation flag) — no graph data of its own.
 *
 * @param set - Zustand set function bound to the parent store state.
 * @param projectId - Project identifier this session's exclusive lock is scoped to.
 */
export function createEditSessionSlice<S extends EditSessionSlice>(
  set: StoreApi<S>['setState'],
  projectId: string,
): EditSessionSlice {
  return {
    beginMutation: () => {
      logger.debug('editSessionSlice: beginMutation', {
        action: 'beginMutation',
        component: 'editSessionSlice',
      });
      set({isMutating: true} as Partial<S>);
    },

    endMutation: () => {
      logger.debug('editSessionSlice: endMutation', {
        action: 'endMutation',
        component: 'editSessionSlice',
      });
      set({isMutating: false} as Partial<S>);
    },

    enterEditMode: () => {
      const acquired = useGlobalStore
        .getState()
        .setActiveExclusiveMode(projectId, 'usecase-edit');

      if (!acquired) {
        logger.debug(
          'editSessionSlice: enterEditMode rejected — lock unavailable',
          {
            action: 'enterEditMode',
            component: 'editSessionSlice',
            projectId,
          },
        );
        return false;
      }

      set({
        mode: 'edit',
        // The raw/subsystem display-mode toggle (LLD §3 Assumptions) is a
        // separate, not-yet-built feature this slice only consumes once it
        // exists; until then this falls back to always 'subsystem' so the
        // subgraph palette is never spuriously disabled.
        usesSubsystemVariant: true,
      } as Partial<S>);

      logger.debug('editSessionSlice: enterEditMode succeeded', {
        action: 'enterEditMode',
        component: 'editSessionSlice',
        projectId,
      });
      return true;
    },

    exitEditMode: () => {
      useGlobalStore
        .getState()
        .releaseExclusiveMode(projectId, 'usecase-edit');
      set({mode: 'view'} as Partial<S>);

      logger.debug('editSessionSlice: exitEditMode', {
        action: 'exitEditMode',
        component: 'editSessionSlice',
        projectId,
      });
    },

    isMutating: false,

    mode: 'view',

    usesSubsystemVariant: true,
  };
}
```

Note `enterEditMode`'s rejection path leaves `mode` untouched (still
`'view'`, its initial value) — there is no `set` call in the `!acquired`
branch, so a rejected acquisition cannot partially mutate session state.

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/edit-session-slice.test.ts"`
Expected: PASS, all 8 tests green.

- [ ] **Step 3: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/edit-session-slice.ts
  git commit -m "feat(react): implement EditSessionSlice mode & lock core" \
             -m "enterEditMode/exitEditMode wrap the cross-project" \
             -m "exclusive lock (setActiveExclusiveMode/releaseExclusiveMode)" \
             -m "so Usecase Edit cannot run concurrently with itself or" \
             -m "Discovery Wizard/Diff-Merge on the same project;" \
             -m "beginMutation/endMutation toggle the single serial" \
             -m "mutation lock (isMutating, REQ-065)." \
             -m "usesSubsystemVariant is stubbed true per LLD Assumptions" \
             -m "pending the separate raw/subsystem display-mode toggle." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 12: Failing tests for `withMutationLock`

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/tests/features/graph-designer/with-mutation-lock.test.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`,
"Per-Operation Loading State" section — the `withMutationLock` code listing
and its surrounding "this is a thrown error, not a toast or silent no-op"
paragraph; LLD §11 "Error Handling" ("Programming-error vs. user-facing
failure distinction"). This task tests `withMutationLock` in isolation
against a store composing the `EditSessionSlice` built in Task 11 — it does
not implement `deleteSelection`/`pasteSelection`'s own mode-check-before-call
exception, which is out of scope for this chapter.

This test file imports `withMutationLock`, which does not exist yet in
`edit-session-slice.ts` — it will fail to compile until Task 13 adds it,
the "RED" step of this task's TDD cycle.

- [ ] **Step 1: Write the failing test**

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import {createStore} from 'zustand';

import {
  createEditSessionSlice,
  type EditSessionSlice,
  withMutationLock,
} from '~features/graph-designer/model/edit-session-slice';
import {useGlobalStore} from '~shared/store/global-store';

function makeStore(projectId: string) {
  return createStore<EditSessionSlice>((set) =>
    createEditSessionSlice(set, projectId),
  );
}

describe('withMutationLock', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('throws and never invokes the action when mode is not edit', async () => {
    const store = makeStore('proj-wml-1');
    const action = jest.fn().mockResolvedValue('unused');

    await expect(withMutationLock(store.getState, action)).rejects.toThrow(
      'withMutationLock called outside Edit mode',
    );

    expect(action).not.toHaveBeenCalled();
    expect(store.getState().isMutating).toBe(false);
  });

  it('runs the action under the mutation lock when mode is edit', async () => {
    const store = makeStore('proj-wml-2');
    store.getState().enterEditMode();
    let isMutatingDuringAction = false;

    const result = await withMutationLock(store.getState, async () => {
      isMutatingDuringAction = store.getState().isMutating;
      return 'done';
    });

    expect(result).toBe('done');
    expect(isMutatingDuringAction).toBe(true);
    expect(store.getState().isMutating).toBe(false);
  });

  it('still calls endMutation (finally guarantee) when the action throws', async () => {
    const store = makeStore('proj-wml-3');
    store.getState().enterEditMode();

    await expect(
      withMutationLock(store.getState, async () => {
        throw new Error('backend call failed');
      }),
    ).rejects.toThrow('backend call failed');

    expect(store.getState().isMutating).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/with-mutation-lock.test.ts"`
Expected: FAIL to compile — `withMutationLock` has no exported member of
that name in `~features/graph-designer/model/edit-session-slice` yet.

- [ ] **Step 3: Commit the test file**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/tests/features/graph-designer/with-mutation-lock.test.ts
  git commit -m "test(react): add failing tests for withMutationLock" \
             -m "Covers the programming-error throw when mode !== 'edit'" \
             -m "(action never invoked), the success path running the" \
             -m "action with isMutating true, and the finally-block" \
             -m "guarantee that endMutation still runs when the action" \
             -m "itself throws." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 13: Implement `withMutationLock` to make Task 12's tests pass

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/features/graph-designer/model/edit-session-slice.ts`
- Test: `packages/react-app/tests/features/graph-designer/with-mutation-lock.test.ts` (from Task 12, unchanged)

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s
`withMutationLock` listing, reproduced here as a generic standalone function
(rather than a closure over one fixed store) so future chapters —
`node-operations-design.md`, `link-and-port-design.md`,
`kv-key-configuration-design.md` — can import and call it against whichever
composed store they run in, as long as that store composes
`EditSessionSlice`.

- [ ] **Step 1: Append `withMutationLock` to `edit-session-slice.ts`**

Add to the end of
`packages/react-app/src/features/graph-designer/model/edit-session-slice.ts`
(after the existing `createEditSessionSlice` function):

```typescript

// ---------------------------------------------------------------------------
// withMutationLock
// ---------------------------------------------------------------------------

/**
 * Runs `action` under the single serial mutation lock (`isMutating`,
 * REQ-065): calls `beginMutation()`, awaits `action()`, and calls
 * `endMutation()` in a `finally` block so the lock always releases, even if
 * `action` throws.
 *
 * Throws — does not toast — when called while `mode !== 'edit'`. This
 * signals a bug in the caller, not a user-facing failure: every legitimate
 * call site is already UI-gated to Edit mode only (palettes, context-menu
 * items, the properties panel's editable fields, the Key Configurator
 * panel don't render outside Edit mode), so reaching this function with the
 * wrong mode means some code path invoked a mutation without going through
 * that gating. The one documented exception, `deleteSelection`/
 * `pasteSelection` (reachable via a global `keydown` listener with no
 * render-layer gate), checks `mode` itself *before* calling this function
 * and no-ops silently instead — that call site is a different chapter, not
 * built here.
 *
 * @param get - Zustand get function for a store composing `EditSessionSlice`.
 * @param action - The backend call (or other async work) to run under the lock.
 */
export async function withMutationLock<S extends EditSessionSlice, T>(
  get: StoreApi<S>['getState'],
  action: () => Promise<T>,
): Promise<T> {
  if (get().mode !== 'edit') {
    throw new Error('withMutationLock called outside Edit mode');
  }

  get().beginMutation();
  try {
    return await action();
  } finally {
    get().endMutation();
  }
}
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/with-mutation-lock.test.ts"`
Expected: PASS, all 3 tests green.

- [ ] **Step 3: Run the full edit-session test suite to confirm no regression**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/(edit-session-slice|with-mutation-lock).test.ts"`
Expected: PASS, all 11 tests green (Task 10's 8 plus Task 12's 3).

- [ ] **Step 4: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/edit-session-slice.ts
  git commit -m "feat(react): implement withMutationLock" \
             -m "Generic helper any store composing EditSessionSlice can" \
             -m "call: begins the serial mutation lock, awaits the" \
             -m "action, and always ends the lock in a finally block." \
             -m "Throws (does not toast) when called outside Edit mode —" \
             -m "a programming-error signal per core-edit-session-design.md," \
             -m "not a user-facing failure. Call sites in" \
             -m "node-operations-design.md/link-and-port-design.md/" \
             -m "kv-key-configuration-design.md are later chapters." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 14: Compose `EditSessionSlice` into `GraphDesignerStore`

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/features/graph-designer/model/graph-designer-store.ts`
- Create: `packages/react-app/tests/features/graph-designer/graph-designer-store.test.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s
Architecture section and LLD §6.1: `EditSessionSlice` is composed into
`GraphDesignerStore` "the same way `GraphDataSlice`, `KeyConfigSlice`,
`VisualizerSlice`, etc. are composed today", appended at the end of the
type intersection and the factory's spread list — matching both design
docs' literal listing order. This is the integration point: Tasks 10–13
proved the slice's logic works in isolation; this task proves it is
reachable from the real `createGraphDesignerStore(tabId, projectId)` factory
every Graph Designer tab uses, with the exclusive lock correctly scoped to
the `projectId` passed at creation (not a single flat flag — REQ-060/062,
same isolation guarantee Task 9 of the exclusive-lock chapter verified at
the `GlobalStore` level, now verified one layer up).

- [ ] **Step 1: Write the failing test**

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import {createGraphDesignerStore} from '~features/graph-designer/model/graph-designer-store';
import {useGlobalStore} from '~shared/store/global-store';

describe('createGraphDesignerStore — EditSessionSlice composition', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('exposes EditSessionSlice state and actions on the composed store', () => {
    const store = createGraphDesignerStore('tab-1', 'proj-gds-1');

    expect(store.getState().mode).toBe('view');
    expect(store.getState().isMutating).toBe(false);

    const acquired = store.getState().enterEditMode();

    expect(acquired).toBe(true);
    expect(store.getState().mode).toBe('edit');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-gds-1'],
    ).toBe('usecase-edit');

    store.getState().exitEditMode();

    expect(store.getState().mode).toBe('view');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-gds-1'],
    ).toBeUndefined();
  });

  it('scopes the exclusive lock to the projectId passed at creation, not a flat flag', () => {
    const storeA = createGraphDesignerStore('tab-a', 'proj-gds-2');
    const storeB = createGraphDesignerStore('tab-b', 'proj-gds-3');

    expect(storeA.getState().enterEditMode()).toBe(true);
    expect(storeB.getState().enterEditMode()).toBe(true);
    expect(storeA.getState().mode).toBe('edit');
    expect(storeB.getState().mode).toBe('edit');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-designer-store.test.ts"`
Expected: FAIL — `store.getState().enterEditMode is not a function` (or
`mode` is `undefined`) — `EditSessionSlice` is not composed into
`GraphDesignerStore` yet.

- [ ] **Step 3: Wire `createEditSessionSlice` into `graph-designer-store.ts`**

In `packages/react-app/src/features/graph-designer/model/graph-designer-store.ts`,
add the import (alphabetically first among the relative-path imports, since
`edit-session-slice` sorts before `graph-data-slice`):

```typescript
import {createEditSessionSlice, type EditSessionSlice} from './edit-session-slice';
import {createGraphDataSlice, type GraphDataSlice} from './graph-data-slice';
```

Add `EditSessionSlice` to the end of the `GraphDesignerStore` type
intersection:

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
  EditSessionSlice;
```

Add the slice's spread to the end of the factory's returned object, after
`...createSearchSlice(set),` and before the existing `selectedUsecases`
seed line:

```typescript
  return createStore<GraphDesignerStore>((set, get) => ({
    ...createUsecaseSelectionSlice(set),
    ...createGraphDataSlice(set, get, projectId),
    ...createVisualizerSlice(set),
    ...createSubsystemSlice(set, get),
    ...createKeyConfigSlice(set),
    ...createValidationResultSlice(set, get),
    ...createModuleListSlice(set, get, projectId),
    ...createSubgraphListSlice(set, get, projectId),
    ...createPropertiesViewSlice(set),
    ...createPanelLayoutSlice(set),
    ...createPanelTabRegistrySlice(set),
    ...createSearchSlice(set),
    ...createEditSessionSlice(set, projectId),

    // Seed usecase selection from global store on creation.
    selectedUsecases: initialSelectedUsecases,
  }));
```

Every other slice's wiring is unchanged — this is three additions (import,
type-intersection member, factory spread) to an otherwise untouched file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-designer-store.test.ts"`
Expected: PASS, both tests green.

- [ ] **Step 5: Run the full graph-designer test suite to confirm no regression**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/"`
Expected: PASS — the existing `graph-data-slice.test.ts` suite plus this
chapter's three new test files, all green.

- [ ] **Step 6: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 7: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/graph-designer-store.ts \
          packages/react-app/tests/features/graph-designer/graph-designer-store.test.ts
  git commit -m "feat(react): compose EditSessionSlice into GraphDesignerStore" \
             -m "Adds EditSessionSlice to the GraphDesignerStore type" \
             -m "intersection and createGraphDesignerStore's factory," \
             -m "matching core-edit-session-design.md/LLD §6.1's composition" \
             -m "order. Verifies the exclusive lock stays scoped to each" \
             -m "store's own projectId rather than a single flat flag" \
             -m "(REQ-060/062), the same isolation guarantee already" \
             -m "verified at the GlobalStore level." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.
### Task 18: `SubgraphProvenance`/`KvCase`/`SubgraphPairDto` types and the four field declarations on `EditSessionSlice`

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/features/graph-designer/model/edit-session-slice.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s "Front-end
store composition"/Mode State sections (LLD §6.1), scoped to exactly the four
session-local bookkeeping fields:

```typescript
subgraphProvenanceById: Map<string, SubgraphProvenance>;
kvCasesById: Map<string, KvCase[]>;
pairLinksById: Map<string, SubgraphPairDto>;
excludedLinks: Connection[];
```

**This task assumes `edit-session-slice.ts` already exists, created by
Tasks 10–14 above** ("`EditSessionSlice` core state & mode machine") —
those tasks declare `EditSessionSlice`'s `mode`/`enterEditMode`/
`exitEditMode`/`isMutating`/`beginMutation`/`endMutation`/
`usesSubsystemVariant` members and the `createEditSessionSlice` factory.
This task adds further members to the same interface/factory, additive
to what Tasks 10–14 already placed there. The snippets below are
additive diffs against that interface/factory, not a full-file listing.

**Why the three referenced types (`SubgraphProvenance`/`KvCase`/
`SubgraphPairDto`) are defined here, in full, rather than imported from a
"belongs to a later chapter" placeholder.** All three are out of scope to
*implement* (their seeding/consumption logic belongs to
`node-operations-design.md`'s and `kv-key-configuration-design.md`'s own
chapters), but the plan format's No Placeholders rule forbids a "type defined
elsewhere" import comment for a type that doesn't exist anywhere in the
codebase yet — that would leave this task's own code non-compiling. All three
shapes are fully specified, simple data shapes (a string-literal union and two
flat interfaces), not complex logic — defining the type is not the same as
implementing the behavior that populates it:
- `SubgraphProvenance` — confirmed verbatim in
  `docs/graph-designer-edit/graph-designer-edit-lld.md` line 98:
  `type SubgraphProvenance = 'pre-loaded' | 'palette-placed' | 'newly-created';`
- `KvCase` — confirmed verbatim in the same LLD, lines 344–350.
- `SubgraphPairDto` — `node-operations-design.md`'s own working-assumption
  shape (lines 657–678), explicitly flagged there as "this document's own
  working assumption" pending backend confirmation of the real (currently
  empty-placeholder) API contract — reproduced here unchanged, including its
  own doc comment caveat, so a future chapter correcting the real shape has
  one place to update.

Later chapters that seed/consume these maps (`node-operations-design.md`,
`kv-key-configuration-design.md`) will import these three types from this
file rather than redeclaring them.

This is a type-only change — there is no runtime behavior to drive with a
failing test, so it is verified by `tsc` instead of `jest`.

- [ ] **Step 1: Add the three referenced types and import their dependencies**

Add near the top of
`packages/react-app/src/features/graph-designer/model/edit-session-slice.ts`,
alongside the type declarations Tasks 10–14 already added (import lines
merge with what's already there — add only the two shown here if they are
not already present):

```typescript
import type {KeyValueInfo} from '~entities/usecases';

import type {Connection} from './graph-data-slice';
```

```typescript
/** Where a subgraph currently on canvas came from this edit session —
 *  stamped once per subgraph, consulted by `recomputeContainersAndSubgraphs`
 *  on every recompute (node-operations-design.md). */
export type SubgraphProvenance =
  | 'newly-created'
  | 'palette-placed'
  | 'pre-loaded';

/** One selectable KV *case* a subgraph supports — a whole Key+Value
 *  combination offered as a unit, not an individually toggleable pair
 *  (kv-key-configuration-design.md's KV Assignment section). */
export interface KvCase {
  id: string; // this case's own SGKV systemId if supported; a client-generated placeholder if custom (never sent to the backend as a systemId)
  keyValuePairs: KeyValueInfo[]; // mirrors KeyValuePairsInfo.keyValueCollection — {keyInfo, valueInfo}[]
  selected: boolean;
  source: 'custom' | 'supported'; // from SGKV vs. user-added (REQ-041/043)
}

/** node-operations-design.md's own working assumption for
 *  `getSubgraphPairs`'s element shape — the real API defines
 *  `SubgraphPairDto` as an empty placeholder object with no fields yet;
 *  confirm against the real contract once the backend team publishes it. */
export interface SubgraphPairDto {
  connectionType: 'control' | 'data';
  fromModuleId: string;
  fromPortId: string;
  id: string; // link ID — same as the resulting Connection's connectionId, and the key used in pairLinksById
  sourceSubgraphId: string;
  targetSubgraphId: string;
  toModuleId: string;
  toPortId: string;
}
```

- [ ] **Step 2: Add the four field declarations to `EditSessionSlice`**

Insert these four members into the `EditSessionSlice` interface, in
alphabetical order among the members Tasks 10–14 already placed there
(this repo's ESLint `sortKeys` rule enforces alphabetical interface
members):

```typescript
  excludedLinks: Connection[];
  kvCasesById: Map<string, KvCase[]>;
  pairLinksById: Map<string, SubgraphPairDto>;
  subgraphProvenanceById: Map<string, SubgraphProvenance>;
```

- [ ] **Step 3: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS (no errors) — added alongside the `EditSessionSlice`
members Tasks 10–14 already declared, the four new fields are additive
and don't yet have any consumer requiring them to be populated with real
data.

- [ ] **Step 4: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/edit-session-slice.ts
  git commit -m "feat(react): add session-local bookkeeping map types" \
             -m "SubgraphProvenance/KvCase/SubgraphPairDto plus the four" \
             -m "EditSessionSlice fields that use them" \
             -m "(subgraphProvenanceById/kvCasesById/pairLinksById/" \
             -m "excludedLinks). Type declarations only, per" \
             -m "core-edit-session-design.md's Front-end store composition" \
             -m "section — seeding/consumption logic belongs to" \
             -m "node-operations-design.md's and" \
             -m "kv-key-configuration-design.md's own chapters." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 19: Initial empty state and `resetSessionLocalMaps` for the four maps

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/tests/features/graph-designer/edit-session-slice.test.ts`
- Modify: `packages/react-app/src/features/graph-designer/model/edit-session-slice.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s Mode
State section: all four maps/arrays start empty when the slice is created,
and are cleared together as one step on every `'→ view'` transition. The
design doc's own sketch expresses the clear as four direct statements
(`get().excludedLinks = []`, `get().pairLinksById.clear()`, etc.) run inline
inside the effect; this task instead exposes that as a single
`resetSessionLocalMaps()` action on the slice — consistent with every other
mutation in this codebase going through `set()` rather than writing directly
onto a `get()` result (`graph-data-slice.ts`'s `clearGraphData`, for example),
and giving the widget wiring (Task 21) one call instead of four inline
statements to invoke and dependency-array.

`createEditSessionSlice`'s signature is `(set, projectId)`, per Task 11 —
it never reads `get()` internally (`enterEditMode`/`exitEditMode` read
`useGlobalStore.getState()` directly, not the parent store's `get()`), so
unlike `createModuleListSlice`/`createSubgraphListSlice`/
`createGraphDataSlice` it does not take a `get` parameter.

- [ ] **Step 1: Write the failing test**

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import {createStore} from 'zustand';

import {createEditSessionSlice} from '~features/graph-designer/model/edit-session-slice';
import type {EditSessionSlice} from '~features/graph-designer/model/edit-session-slice';

function makeStore() {
  return createStore<EditSessionSlice>((set) =>
    createEditSessionSlice(set, 'proj-1'),
  );
}

describe('EditSessionSlice — session-local bookkeeping maps', () => {
  it('starts with all four session-local maps/arrays empty', () => {
    const store = makeStore();

    expect(store.getState().excludedLinks).toEqual([]);
    expect(store.getState().kvCasesById.size).toBe(0);
    expect(store.getState().pairLinksById.size).toBe(0);
    expect(store.getState().subgraphProvenanceById.size).toBe(0);
  });

  it('resetSessionLocalMaps clears all four fields back to empty', () => {
    const store = makeStore();
    store.setState({
      excludedLinks: [
        {
          connectionId: 'link-1',
          connectionType: 'data',
          fromModuleId: 'm1',
          fromPortId: 'p1',
          toModuleId: 'm2',
          toPortId: 'p2',
        },
      ],
      kvCasesById: new Map([['sg-1', []]]),
      pairLinksById: new Map([
        [
          'link-2',
          {
            connectionType: 'data' as const,
            fromModuleId: 'm3',
            fromPortId: 'p3',
            id: 'link-2',
            sourceSubgraphId: 'sg-1',
            targetSubgraphId: 'sg-2',
            toModuleId: 'm4',
            toPortId: 'p4',
          },
        ],
      ]),
      subgraphProvenanceById: new Map([['sg-1', 'pre-loaded' as const]]),
    });

    store.getState().resetSessionLocalMaps();

    expect(store.getState().excludedLinks).toEqual([]);
    expect(store.getState().kvCasesById.size).toBe(0);
    expect(store.getState().pairLinksById.size).toBe(0);
    expect(store.getState().subgraphProvenanceById.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/edit-session-slice.test.ts"`
Expected: FAIL — either a module/typecheck error if `resetSessionLocalMaps`
doesn't exist yet on `EditSessionSlice`, or (if the sibling chapter's own
tests already exist in this same file) new failures on the two `it` blocks
above specifically, with `TypeError: store.getState().resetSessionLocalMaps
is not a function` or the initial `kvCasesById`/`pairLinksById`/
`subgraphProvenanceById` fields being `undefined`.

- [ ] **Step 3: Add the initial state and `resetSessionLocalMaps` action**

Add `resetSessionLocalMaps: () => void;` to the `EditSessionSlice` interface
(Task 18 already added the four field declarations), in alphabetical order —
it sorts between `pairLinksById` and `subgraphProvenanceById`:

```typescript
  excludedLinks: Connection[];
  kvCasesById: Map<string, KvCase[]>;
  pairLinksById: Map<string, SubgraphPairDto>;
  resetSessionLocalMaps: () => void;
  subgraphProvenanceById: Map<string, SubgraphProvenance>;
```

In `createEditSessionSlice`'s returned object, add the four initial values
and the action, merged alphabetically alongside whatever members the sibling
chapter's own tasks already return:

```typescript
    excludedLinks: [],
    kvCasesById: new Map(),
    pairLinksById: new Map(),
    resetSessionLocalMaps: (): void => {
      set({
        excludedLinks: [],
        kvCasesById: new Map(),
        pairLinksById: new Map(),
        subgraphProvenanceById: new Map(),
      });
    },
    subgraphProvenanceById: new Map(),
```

A fresh `Map`/array instance is created on every call (rather than calling
`.clear()` on the existing one) to match this codebase's existing
`set()`-replaces-the-value convention (`graph-data-slice.ts`'s
`clearGraphData`), rather than the design doc's own sketch of mutating the
`Map` in place via `get().pairLinksById.clear()` — behaviorally identical
(all four end up empty), but consistent with how every other slice in this
codebase resets state.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/edit-session-slice.test.ts"`
Expected: PASS, both new tests green (plus any of the sibling chapter's own
tests already in this file, unaffected by this change).

- [ ] **Step 5: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/edit-session-slice.ts \
          packages/react-app/tests/features/graph-designer/edit-session-slice.test.ts
  git commit -m "feat(react): seed and reset the four session-local maps" \
             -m "subgraphProvenanceById/kvCasesById/pairLinksById start" \
             -m "empty and excludedLinks starts as []; resetSessionLocalMaps" \
             -m "clears all four back to empty in one call, for Effect A's" \
             -m "'view' transition guard (core-edit-session-design.md's" \
             -m "Mode State section)." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 20: `shouldResetSessionLocalMaps` — the mode-transition guard predicate

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/src/widgets/graph-designer/lib/session-local-maps.ts`
- Create: `packages/react-app/tests/widgets/graph-designer/lib/session-local-maps.test.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s Mode
State section: "Effect A's body, on every run where `mode === 'view'` …
clears all four maps together." This task extracts that one-line condition
into its own pure, directly-unit-testable function in
`widgets/graph-designer/lib/` — the same location this widget already keeps
its other pure helpers (`apply-collapses.ts`, `apply-position-overrides.ts`,
`graph-search.ts`) rather than inline component logic, precisely so the
mode-transition behavior itself (clears on `'view'`, does not clear on
`'edit'`, regardless of the *previous* mode) can be verified without
mounting `GraphDesigner` — a large component with no existing render-test
harness in this repo (`graph-designer.tsx` has no `tests/widgets/
graph-designer/ui/*.test.tsx` counterpart today; only its `lib/` helpers are
unit tested). Task 21 wires this predicate into Effect A itself.

- [ ] **Step 1: Write the failing test**

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {shouldResetSessionLocalMaps} from '~widgets/graph-designer/lib/session-local-maps';

describe('shouldResetSessionLocalMaps', () => {
  it('returns true on a transition into view mode', () => {
    expect(shouldResetSessionLocalMaps('view')).toBe(true);
  });

  it('returns false while staying in or transitioning into edit mode', () => {
    expect(shouldResetSessionLocalMaps('edit')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/widgets/graph-designer/lib/session-local-maps.test.ts"`
Expected: FAIL with a module-not-found error, e.g. `Cannot find module
'~widgets/graph-designer/lib/session-local-maps'` — the file does not exist
yet.

- [ ] **Step 3: Write the minimal implementation**

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * The four session-local `EditSessionSlice` bookkeeping maps
 * (`subgraphProvenanceById`/`kvCasesById`/`pairLinksById`/`excludedLinks`)
 * have no source of truth to recompute from once the edit session that
 * populated them ends, so they must be cleared on every transition *into*
 * `'view'` — initial mount, post-Apply, and post-Discard alike — but never
 * on the `'view' → 'edit'` transition, which must not wipe state a session
 * in progress needs (core-edit-session-design.md's Mode State section).
 */
export function shouldResetSessionLocalMaps(mode: 'edit' | 'view'): boolean {
  return mode === 'view';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/widgets/graph-designer/lib/session-local-maps.test.ts"`
Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/widgets/graph-designer/lib/session-local-maps.ts \
          packages/react-app/tests/widgets/graph-designer/lib/session-local-maps.test.ts
  git commit -m "feat(react): add session-local-maps reset guard predicate" \
             -m "shouldResetSessionLocalMaps(mode) isolates Effect A's" \
             -m "'clear on transition into view, never on edit' condition" \
             -m "as a pure, unit-testable function" \
             -m "(core-edit-session-design.md's Mode State section)." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 21: Wire the clearing behavior into `graph-designer.tsx`'s Effect A

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/widgets/graph-designer/ui/graph-designer.tsx`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s
Mode State section, wiring Task 19's `resetSessionLocalMaps()` and Task 20's
`shouldResetSessionLocalMaps()` into the existing "Effect A" (the
`selectedUsecases`-driven load effect at lines 277–300 of
`graph-designer.tsx`, confirmed by direct read of the current file). This
task touches **only** the four-map clearing call — it does not touch the
existing search/level-view/collapse/position-override/viewport reset lines
already in that effect, and it does not add the `kvCasesById`/
`subgraphProvenanceById` seeding loops the design doc describes running
immediately after the clear — those loops read from `getAllSubgraphs`/
placement fetches and belong to `kv-key-configuration-design.md`'s and
`node-operations-design.md`'s own chapters, explicitly out of scope here per
this chapter's brief.

**This task depends on `mode` being a readable field on the composed
`GraphDesignerStore`**, added by Tasks 10–14 and composed into
`GraphDesignerStore` there — execute those tasks first.

- [ ] **Step 1: Add the `mode` and `resetSessionLocalMaps` selectors**

In `packages/react-app/src/widgets/graph-designer/ui/graph-designer.tsx`,
alongside the existing `loadGraphData` selector (around line 84):

```typescript
  const loadGraphData = useGraphDesignerStoreShallow((s) => s.loadGraphData);
  const mode = useGraphDesignerStoreShallow((s) => s.mode);
  const resetSessionLocalMaps = useGraphDesignerStoreShallow(
    (s) => s.resetSessionLocalMaps,
  );
```

- [ ] **Step 2: Add the import and call the guard inside Effect A**

Add the import alongside this file's other `../lib/` imports (near
`applyCollapses`/`applyPositionOverrides`):

```typescript
import {applyCollapses} from '../lib/apply-collapses';
import {applyPositionOverrides} from '../lib/apply-position-overrides';
import {shouldResetSessionLocalMaps} from '../lib/session-local-maps';
```

Modify Effect A (lines 277–300) to call the guard immediately after the
existing UI-state resets and before the `selectedUsecases.length === 0`
early return — the same position core-edit-session-design.md places the
four-map clear relative to the rest of the effect's body (immediately before
where the not-yet-implemented `kvCasesById` reseed loop will go in a later
chapter):

```typescript
  // Effect A — trigger load when selection changes
  useEffect(() => {
    resetSearch();
    clearLevelView();
    setCollapseByLevel({});
    setPositionOverrides({});
    setParentSizes({});
    setViewportByLevel({});
    if (shouldResetSessionLocalMaps(mode)) {
      // No source of truth to recompute subgraphProvenanceById/kvCasesById/
      // pairLinksById/excludedLinks from once the edit session that
      // populated them ends — clear them on every transition into 'view'
      // so a previous session's entries never leak into the next
      // (core-edit-session-design.md's Mode State section).
      resetSessionLocalMaps();
    }
    if (selectedUsecases.length === 0) {
      return;
    }
    const systemIds = getSystemIdsFromFormattedUsecases(
      selectedUsecases,
      usecaseData,
    );
    if (systemIds.length > 0) {
      void loadGraphData(systemIds);
    }
  }, [
    selectedUsecases,
    usecaseData,
    clearLevelView,
    loadGraphData,
    mode,
    resetSearch,
    resetSessionLocalMaps,
  ]);
```

`mode` and `resetSessionLocalMaps` are added to the dependency array in their
correct alphabetical position among the effect's existing dependencies,
matching this file's existing dependency-array ordering convention.

- [ ] **Step 3: Verify the project still typechecks and the guard's own unit tests still pass**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS once composed with the sibling chapter's `mode`/
`resetSessionLocalMaps` additions to `EditSessionSlice` (Task 19, and the
sibling chapter's own `mode` field).

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/widgets/graph-designer/lib/session-local-maps.test.ts"`
Expected: PASS, unaffected by this wiring change (the predicate itself is
untouched).

- [ ] **Step 4: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/widgets/graph-designer/ui/graph-designer.tsx
  git commit -m "feat(react): clear session-local maps on view transition" \
             -m "Effect A now calls resetSessionLocalMaps() whenever" \
             -m "shouldResetSessionLocalMaps(mode) is true — initial mount," \
             -m "post-Apply, and post-Discard alike — so a previous edit" \
             -m "session's subgraphProvenanceById/kvCasesById/" \
             -m "pairLinksById/excludedLinks entries never leak into the" \
             -m "next session. Does not touch the existing search/" \
             -m "level-view/collapse reset already in this effect, nor add" \
             -m "the KV/provenance seeding loops — those are separate," \
             -m "later chapters." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.
### Task 24: `applyAddedCollection`/`applyDeletedCollection` — module bucket (`upsertModule`/`removeModule`)

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts` (add cases to the existing file)
- Modify: `packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s
"Response Reconciliation — Component Collections" section (LLD §6.3). This
task implements the leaf-level bucket appliers — `applyAddedCollection`,
`applyDeletedCollection`, and the six per-entity `upsert*`/`remove*` helpers
they're built from. Tasks 30–34 implement the
top-level `applyComponentCollection` orchestrator, `recomputeContainersAndSubgraphs`,
`pruneDeletedLinkBookkeeping`, and `adjustSurvivingPortCounts`/
`adjustPortForLink` — none of that is touched here.

**`ComponentCollectionDto`/`ChangeInfoDto` already exist — this task imports
them, it does not redeclare them.** Both are already declared in
`packages/react-app/src/entities/usecases/model/usecase-component.dto.ts`
(confirmed by reading Task 1, which added this file's
*other* DTOs alongside them, and by reading the file itself):

```typescript
export interface ChangeInfoDto {
  changeId?: string;
  changeStatus?: 'STAGED' | 'UNSTAGED';
  changeType: 'NONE' | 'CREATE' | 'UPDATE' | 'DELETE';
}
// ...
export interface ComponentCollectionDto {
  controlLinks: ControlLinkDto[];
  dataLinks: DataLinkDto[];
  spfModules: SpfModuleDto[];
  subsystems?: SubsystemDto[];
}
```

This task (and its two sibling tasks, 25–26) import these from
`~entities/usecases/model/usecase-component.dto` — the same path
`features/graph-designer/lib/subsystem-tree.utils.ts` already imports
`SpfModuleDto`/`SubsystemDto` from today, confirmed by reading that file; no
existing barrel (`~entities/usecases`) re-exports these particular types, so
the direct model path is correct, not a shortcut.

**Building block, not the whole reconciler.** By the end of this task,
`applyAddedCollection`/`applyDeletedCollection` only handle the `spfModules`
bucket — `dataLinks`/`controlLinks` (Task 25) and the optional `subsystems`
bucket (Task 26) are wired in by the next two tasks, each *extending* the
same two function bodies (shown in full again each time, per this plan
format's "no placeholder" rule — there is no partial/no-op stub for the
buckets this task doesn't yet handle; a collection containing links or
subsystems simply has those arrays silently unread until Task 25/26 land,
which is fine since no production call site exists yet to feed them one).

**Cross-chapter type dependency: `ModuleInstance.id`.** `toModuleInstance`
below (and `resolveEndpointSystemId` in Task 25) need the module's own
numeric primary key to resolve a link's numeric `sourceId`/`destinationId`
back to a `moduleInstanceId` later. That field does not exist on the real
`ModuleInstance` interface today — it is added by this chapter's sibling
file, **Task 30** (mirroring
`Subsystem.id`, which already exists). Both files are one chapter split only
for size, not two independent chapters — **apply Task 30 first** if
executing in strict task-number order; this task's `tsc` step will fail with
`Object literal may only specify known properties, and 'id' does not exist
in type 'ModuleInstance'` until that field exists.

**No `diffState` is set on upserted modules.** The design doc is explicit
that "an entity's own `changeInfo.changeType` must not be read by the
reconciler for a mutation response" — bucket membership is the only signal.
`diffState` is derived from `changeType` and exists to drive Diff/Merge
snapshot rendering (`loadGraphData`'s read-only full-snapshot path); a
mutation response reconciled through `applyAddedCollection`/
`applyDeletedCollection` is never a diff snapshot, so `toModuleInstance`
below leaves `diffState`/`diffChangedFields` unset rather than deriving them
from `m.changeInfo?.changeType` the way `loadGraphData` does.

**An upserted module's canvas `position` is preserved, not reset.**
`SpfModuleDto` carries no position field at all (REQ-058/059's placement and
position-override mechanism is a separate, out-of-scope concern per this
feature's Open Items) — `loadGraphData` defaults every module to
`{x: 0, y: 0}` because on a full load there is no prior position to keep.
An *incremental* upsert is different: if the module already exists in
`moduleInstances` (an "updated" entity — e.g. a rename), blindly defaulting
its `position` back to `{x: 0, y: 0}` on every update response would silently
teleport it on the canvas. `toModuleInstance` below takes the previous
`ModuleInstance` (if any) and carries its `position` forward, defaulting to
`{x: 0, y: 0}` only for a module that didn't previously exist.

- [ ] **Step 1: Write the failing test**

Add to the end of the `describe` block in
`packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts`.
First, hoist this fixture builder to file scope (alongside the existing
`minimalDto` constant) — later tasks in this chapter (25–26) reuse it:

```typescript
import type {
  SpfModuleDto,
} from '~entities/usecases/model/usecase-component.dto';

function makeSpfModuleDto(overrides: Partial<SpfModuleDto> = {}): SpfModuleDto {
  return {
    alias: '',
    changeInfo: {changeType: 'CREATE'},
    containerId: 10,
    controlPorts: [],
    dataPorts: [],
    heapId: 0,
    id: 1,
    maxControlPortsSupported: 0,
    maxInputPortsSupported: 0,
    maxOutputPortsSupported: 0,
    moduleId: 200,
    name: 'AudioDecoder',
    relatedEndPointLinks: [],
    subgraphId: 1,
    systemId: 'sys-mod-1',
    ...overrides,
  };
}
```

Then add the test cases:

```typescript
describe('applyAddedCollection / applyDeletedCollection — modules', () => {
  it('upserts a new module into moduleInstances, resolving moduleType from moduleList', () => {
    const store = makeStore([
      {
        builtIn: false,
        category: '',
        description: '',
        dspType: '',
        inputPorts: [],
        moduleId: '200',
        moduleName: 'AudioDecoder',
        moduleType: 'SOURCE',
        outputPorts: [],
      },
    ]);
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {},
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    store.getState().applyAddedCollection({
      controlLinks: [],
      dataLinks: [],
      spfModules: [makeSpfModuleDto()],
    });

    const instance = store.getState().graphData!.moduleInstances['sys-mod-1'];
    expect(instance).toBeDefined();
    expect(instance.moduleType).toBe('SOURCE');
    expect(instance.id).toBe(1);
  });

  it("preserves an existing module's position when it is upserted again (an \"updated\" entry)", () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {
          'sys-mod-1': {
            containerId: '10',
            displayName: 'AudioDecoder',
            id: 1,
            inputPorts: [],
            moduleId: '200',
            moduleInstanceId: 'sys-mod-1',
            moduleName: 'AudioDecoder',
            moduleType: '',
            outputPorts: [],
            position: {x: 42, y: 7},
            subgraphId: '1',
          },
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    store.getState().applyAddedCollection({
      controlLinks: [],
      dataLinks: [],
      spfModules: [makeSpfModuleDto({name: 'AudioDecoderRenamed'})],
    });

    const instance = store.getState().graphData!.moduleInstances['sys-mod-1'];
    expect(instance.displayName).toBe('AudioDecoderRenamed');
    expect(instance.position).toEqual({x: 42, y: 7});
  });

  it('removes a module from moduleInstances via applyDeletedCollection', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {
          'sys-mod-1': {
            containerId: '10',
            displayName: 'AudioDecoder',
            id: 1,
            inputPorts: [],
            moduleId: '200',
            moduleInstanceId: 'sys-mod-1',
            moduleName: 'AudioDecoder',
            moduleType: '',
            outputPorts: [],
            position: {x: 0, y: 0},
            subgraphId: '1',
          },
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    store.getState().applyDeletedCollection({
      controlLinks: [],
      dataLinks: [],
      spfModules: [makeSpfModuleDto()],
    });

    expect(
      store.getState().graphData!.moduleInstances['sys-mod-1'],
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: FAIL — `TypeError: store.getState().applyAddedCollection is not a
function` (neither action exists yet).

- [ ] **Step 3: Implement `toModuleInstance`, `upsertModule`, `removeModule`, and the two actions**

At the top of `graph-data-slice.ts`, add the new import (this is the first
task in this chapter to need DTO types; merge with whatever the sibling
chapter's own import additions look like if both land in the same working
tree):

```typescript
import type {
  ComponentCollectionDto,
  SpfModuleDto,
} from '~entities/usecases/model/usecase-component.dto';
```

Add these standalone functions below the existing `toDiffState` function
(private to this module — not exported, same treatment as every other
internal helper in this file):

```typescript
/**
 * Maps one `SpfModuleDto` to a `ModuleInstance`, the same shape
 * `loadGraphData`'s module-mapping loop already builds — reused here for
 * incremental reconciliation (core-edit-session-design.md LLD §6.3).
 *
 * Deliberately does not set `diffState`/`diffChangedFields` from
 * `m.changeInfo?.changeType` the way `loadGraphData` does: a mutation
 * response's bucket membership (added/updated/deleted), not an entity's own
 * `changeInfo.changeType`, is the sole reconciliation signal — see the
 * Response Reconciliation section's "Bucket membership is now the sole
 * signal" note. `diffState` itself is a Diff/Merge snapshot-rendering
 * concept that does not apply to a live edit-session mutation.
 *
 * `existing` (the module's own prior `ModuleInstance`, if any) is consulted
 * only for `position` — `SpfModuleDto` carries no position field at all, so
 * an update must carry the canvas position forward rather than resetting it
 * to `loadGraphData`'s full-load default of `{x: 0, y: 0}`.
 */
function toModuleInstance(
  m: SpfModuleDto,
  moduleType: string,
  existing: ModuleInstance | undefined,
): ModuleInstance {
  const inputPorts: Port[] = (m.dataPorts ?? [])
    .filter((p) => p.portIoType === 'Input')
    .map((p) => ({
      direction: 'input' as const,
      isStatic: p.portType === 'Static',
      portId: p.systemId,
      portName: p.name,
      portType: 'data' as const,
      totalLinksAtPort: p.totalLinksAtPort,
    }));
  const controlPorts: Port[] = (m.controlPorts ?? []).map((p) => ({
    direction: 'input' as const,
    isStatic: p.portType === 'Static',
    portId: p.systemId,
    portName: p.controlPortName,
    portType: 'control' as const,
    totalLinksAtPort: 0, // ControlPortDto has no totalLinksAtPort field
  }));
  const outputPorts: Port[] = (m.dataPorts ?? [])
    .filter((p) => p.portIoType === 'Output')
    .map((p) => ({
      direction: 'output' as const,
      isStatic: p.portType === 'Static',
      portId: p.systemId,
      portName: p.name,
      portType: 'data' as const,
      totalLinksAtPort: p.totalLinksAtPort,
    }));
  return {
    containerId: String(m.containerId),
    displayName: m.alias || m.name,
    id: m.id,
    inputPorts: [...inputPorts, ...controlPorts],
    moduleId: String(m.moduleId),
    moduleInstanceId: m.systemId,
    moduleName: m.name,
    moduleType,
    outputPorts,
    position: existing?.position ?? {x: 0, y: 0},
    subgraphId: String(m.subgraphId),
  };
}

function upsertModule(
  moduleInstances: Record<string, ModuleInstance>,
  m: SpfModuleDto,
  moduleType: string,
): Record<string, ModuleInstance> {
  return {
    ...moduleInstances,
    [m.systemId]: toModuleInstance(m, moduleType, moduleInstances[m.systemId]),
  };
}

function removeModule(
  moduleInstances: Record<string, ModuleInstance>,
  m: SpfModuleDto,
): Record<string, ModuleInstance> {
  const next = {...moduleInstances};
  delete next[m.systemId];
  return next;
}
```

Add to the `GraphDataSlice` interface, in alphabetical order (both sort
before `clearGraphData`):

```typescript
  applyAddedCollection: (collection: ComponentCollectionDto) => void;
  applyDeletedCollection: (collection: ComponentCollectionDto) => void;
```

Add to `createGraphDataSlice`'s returned object, in the same alphabetical
position:

```typescript
    applyAddedCollection: (collection: ComponentCollectionDto): void => {
      const {graphData, moduleList} = get();
      if (!graphData) {
        return;
      }
      const defModuleTypeById = new Map(
        moduleList.map((d) => [d.moduleId, d.moduleType]),
      );
      let moduleInstances = graphData.moduleInstances;
      for (const m of collection.spfModules) {
        moduleInstances = upsertModule(
          moduleInstances,
          m,
          defModuleTypeById.get(String(m.moduleId)) ?? '',
        );
      }
      logger.debug('graphDataSlice: applyAddedCollection', {
        action: 'applyAddedCollection',
        component: 'graphDataSlice',
      });
      set({
        graphData: {...graphData, moduleInstances},
      } as unknown as Partial<S>);
    },

    applyDeletedCollection: (collection: ComponentCollectionDto): void => {
      const {graphData} = get();
      if (!graphData) {
        return;
      }
      let moduleInstances = graphData.moduleInstances;
      for (const m of collection.spfModules) {
        moduleInstances = removeModule(moduleInstances, m);
      }
      logger.debug('graphDataSlice: applyDeletedCollection', {
        action: 'applyDeletedCollection',
        component: 'graphDataSlice',
      });
      set({
        graphData: {...graphData, moduleInstances},
      } as unknown as Partial<S>);
    },
```

Both actions build a fresh `moduleInstances` record (via the spread inside
`upsertModule`/the copy-then-delete inside `removeModule`) and commit once
via `set()` — this store has no Immer middleware, so mutating
`graphData.moduleInstances` in place would silently fail to trigger
re-renders in components subscribed via reference-equality selectors, the
same reasoning Task 33 documents
for port-count adjustment.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: PASS, all three new tests green, and every pre-existing
`loadGraphData` test in this file still green.

- [ ] **Step 5: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS — **conditional on `ModuleInstance.id` already existing**
(Task 30, see this task's Spec
note above). If that task has not landed yet, this step fails with `Object
literal may only specify known properties, and 'id' does not exist in type
'ModuleInstance'` inside `toModuleInstance` — apply Task 30 first.

- [ ] **Step 6: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/graph-data-slice.ts \
          packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts
  git commit -m "feat(react): add applyAddedCollection/applyDeletedCollection (modules)" \
             -m "First slice of the response-reconciliation bucket appliers" \
             -m "(core-edit-session-design.md LLD 6.3) — upsertModule/removeModule" \
             -m "merge a ComponentCollectionDto's spfModules bucket into" \
             -m "moduleInstances, preserving canvas position across updates and" \
             -m "leaving diffState unset (bucket membership, not changeType, is" \
             -m "the reconciliation signal for a mutation response). Link and" \
             -m "subsystem buckets land in the next two tasks of this chapter." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 25: Extend to the link buckets (`upsertLink`/`removeLink`, `resolveEndpointSystemId`)

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts` (add cases to the existing file)
- Modify: `packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s
Response Reconciliation section — `dataLinks`/`controlLinks` are merged into
`GraphDataSlice.connections` the same way `upsertModule`/`removeModule`
(Task 24) merge `spfModules` into `moduleInstances`.

**Resolving a link's numeric `sourceId`/`destinationId` needs a broader
lookup than `03-01b`'s `findModuleByNumericId`.** `DataLinkDto`/
`ControlLinkDto.sourceId`/`destinationId` are numeric backend ids — never
the string `systemId` `Connection.fromModuleId`/`toModuleId` needs
(`canvas-ui-mechanics-design.md`'s Port Coloring section, confirmed by
reading `DataLinkDto`/`ControlLinkDto` in `usecase-component.dto.ts`: their
`sourceId`/`destinationId` are `number`, distinct from the link's own string
`systemId`). `loadGraphData` resolves this today via a function-local
`numericIdToSystemId` map built from **both** `spfModules` and
`subsystemDtos` — a link endpoint can be a module *or* a subsystem
(REQ-027's cross-subsystem bridge hop). `03-01b`'s `findModuleByNumericId`
only searches `moduleInstances` (sufficient for its own narrower job,
`adjustPortForLink`, which is module-port-only per REQ-064). `upsertLink`
below needs the module-*or*-subsystem generality `loadGraphData` has, so it
uses its own resolver, `resolveEndpointSystemId`, searching `moduleInstances`
by `ModuleInstance.id` (Task 24's cross-chapter dependency on
Task 30, still in effect here) and
falling back to `subsystems` by `Subsystem.id` (already present on the real
type today — no new field needed for the subsystem half of this lookup).

**No `diffState` is set on upserted links**, for the same reason modules
don't get one (Task 24): bucket membership, not `changeInfo.changeType`, is
the reconciliation signal, and `diffState` is a Diff/Merge-only concept.

- [ ] **Step 1: Write the failing test**

Hoist this fixture builder to file scope alongside `makeSpfModuleDto`
(Task 24) — note for whoever executes
Task 32: if that task's own `makeDataLinkDto` lands in the same working tree,
reuse this one instead of redefining it (same field set) — but keep *this*
version's `connectionType` value, not that task's draft `'DataConnection'`,
which is not a member of the real `ConnectionType` union confirmed below:

```typescript
import type {
  ComponentCollectionDto,
  DataLinkDto,
  SpfModuleDto,
} from '~entities/usecases/model/usecase-component.dto';

function makeDataLinkDto(overrides: Partial<DataLinkDto> = {}): DataLinkDto {
  return {
    changeInfo: {changeType: 'CREATE'},
    connectionType: 'MODULE_MODULE',
    destinationId: 2,
    destinationPortId: 20,
    isDangling: false,
    name: 'link',
    relatedEndPointLinks: [],
    sourceId: 1,
    sourcePortId: 10,
    systemId: 'link-1',
    ...overrides,
  };
}
```

Then add the test cases:

```typescript
describe('applyAddedCollection / applyDeletedCollection — links', () => {
  it('upserts a data link, resolving a module endpoint and a subsystem endpoint by numeric id', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {
          'sys-mod-1': {
            containerId: '10',
            displayName: 'AudioDecoder',
            id: 1,
            inputPorts: [],
            moduleId: '200',
            moduleInstanceId: 'sys-mod-1',
            moduleName: 'AudioDecoder',
            moduleType: '',
            outputPorts: [],
            position: {x: 0, y: 0},
            subgraphId: '1',
          },
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {
          'sys-ss-1': {
            controlPorts: [],
            dataPorts: [],
            id: 99,
            subgraphs: [],
            subsystemId: 'sys-ss-1',
            subsystemName: 'Subsystem A',
          },
        },
      },
    });

    store.getState().applyAddedCollection({
      controlLinks: [],
      dataLinks: [
        makeDataLinkDto({destinationId: 99, sourceId: 1, systemId: 'link-1'}),
      ],
      spfModules: [],
    });

    const conn = store
      .getState()
      .graphData!.connections.find((c) => c.connectionId === 'link-1');
    expect(conn).toEqual({
      connectionId: 'link-1',
      connectionType: 'data',
      fromModuleId: 'sys-mod-1',
      fromPortId: '10',
      toModuleId: 'sys-ss-1',
      toPortId: '20',
    });
  });

  it('removes a link via applyDeletedCollection, leaving other connections untouched', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [
          {
            connectionId: 'link-1',
            connectionType: 'data',
            fromModuleId: 'sys-mod-1',
            fromPortId: '10',
            toModuleId: 'sys-ss-1',
            toPortId: '20',
          },
          {
            connectionId: 'link-survivor',
            connectionType: 'data',
            fromModuleId: 'sys-mod-2',
            fromPortId: '11',
            toModuleId: 'sys-mod-3',
            toPortId: '21',
          },
        ],
        containers: {},
        moduleInstances: {},
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    store.getState().applyDeletedCollection({
      controlLinks: [],
      dataLinks: [makeDataLinkDto({systemId: 'link-1'})],
      spfModules: [],
    });

    expect(
      store.getState().graphData!.connections.map((c) => c.connectionId),
    ).toEqual(['link-survivor']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: FAIL — the two new assertions fail because `applyAddedCollection`/
`applyDeletedCollection` (Task 24's version) never read `dataLinks`/
`controlLinks`, so `connections` stays empty/unchanged: `expect(conn).toEqual(...)`
fails with `conn` being `undefined`, and the delete test's `.toEqual(['link-survivor'])`
fails because both links are still present.

- [ ] **Step 3: Implement `resolveEndpointSystemId`, `upsertLink`, `removeLink`, and extend both actions**

Add the DTO import (merge with Task 24's import block):

```typescript
import type {
  ComponentCollectionDto,
  ControlLinkDto,
  DataLinkDto,
  SpfModuleDto,
} from '~entities/usecases/model/usecase-component.dto';
```

Add these standalone functions below `removeModule` (Task 24):

```typescript
/**
 * Resolves a link endpoint's numeric backend id (`DataLinkDto`/
 * `ControlLinkDto.sourceId`/`destinationId`) to the string `systemId`
 * `Connection.fromModuleId`/`toModuleId` needs — the endpoint may be a
 * module *or* a subsystem (REQ-027's cross-subsystem bridge hop), so both
 * records are searched, module first. Returns `undefined` if neither
 * matches (an endpoint deleted in the same response, or one this response
 * simply doesn't carry context for) — callers fall back to
 * `String(numericId)`, the same graceful-degradation `loadGraphData`'s own
 * `numericIdToSystemId` lookup already uses.
 */
function resolveEndpointSystemId(
  moduleInstances: Record<string, ModuleInstance>,
  subsystems: Record<string, Subsystem>,
  numericId: number,
): string | undefined {
  const module = Object.values(moduleInstances).find(
    (m) => m.id === numericId,
  );
  if (module) {
    return module.moduleInstanceId;
  }
  return Object.values(subsystems).find((ss) => ss.id === numericId)
    ?.subsystemId;
}

function upsertLink(
  moduleInstances: Record<string, ModuleInstance>,
  subsystems: Record<string, Subsystem>,
  connections: Connection[],
  link: ControlLinkDto | DataLinkDto,
  connectionType: 'control' | 'data',
): Connection[] {
  const conn: Connection = {
    connectionId: link.systemId,
    connectionType,
    fromModuleId:
      resolveEndpointSystemId(moduleInstances, subsystems, link.sourceId) ??
      String(link.sourceId),
    fromPortId: String(link.sourcePortId),
    toModuleId:
      resolveEndpointSystemId(
        moduleInstances,
        subsystems,
        link.destinationId,
      ) ?? String(link.destinationId),
    toPortId: String(link.destinationPortId),
  };
  return [
    ...connections.filter((c) => c.connectionId !== conn.connectionId),
    conn,
  ];
}

function removeLink(
  connections: Connection[],
  link: ControlLinkDto | DataLinkDto,
): Connection[] {
  return connections.filter((c) => c.connectionId !== link.systemId);
}
```

Replace `applyAddedCollection`/`applyDeletedCollection`'s bodies (from
Task 24) with these extended versions — modules are still upserted/removed
first, so a link whose endpoint module is newly-created in the *same*
collection already resolves by the time the link loop runs:

```typescript
    applyAddedCollection: (collection: ComponentCollectionDto): void => {
      const {graphData, moduleList} = get();
      if (!graphData) {
        return;
      }
      const defModuleTypeById = new Map(
        moduleList.map((d) => [d.moduleId, d.moduleType]),
      );
      let moduleInstances = graphData.moduleInstances;
      for (const m of collection.spfModules) {
        moduleInstances = upsertModule(
          moduleInstances,
          m,
          defModuleTypeById.get(String(m.moduleId)) ?? '',
        );
      }
      let connections = graphData.connections;
      for (const l of collection.dataLinks) {
        connections = upsertLink(
          moduleInstances,
          graphData.subsystems,
          connections,
          l,
          'data',
        );
      }
      for (const l of collection.controlLinks) {
        connections = upsertLink(
          moduleInstances,
          graphData.subsystems,
          connections,
          l,
          'control',
        );
      }
      logger.debug('graphDataSlice: applyAddedCollection', {
        action: 'applyAddedCollection',
        component: 'graphDataSlice',
      });
      set({
        graphData: {...graphData, connections, moduleInstances},
      } as unknown as Partial<S>);
    },

    applyDeletedCollection: (collection: ComponentCollectionDto): void => {
      const {graphData} = get();
      if (!graphData) {
        return;
      }
      let moduleInstances = graphData.moduleInstances;
      for (const m of collection.spfModules) {
        moduleInstances = removeModule(moduleInstances, m);
      }
      let connections = graphData.connections;
      for (const l of collection.dataLinks) {
        connections = removeLink(connections, l);
      }
      for (const l of collection.controlLinks) {
        connections = removeLink(connections, l);
      }
      logger.debug('graphDataSlice: applyDeletedCollection', {
        action: 'applyDeletedCollection',
        component: 'graphDataSlice',
      });
      set({
        graphData: {...graphData, connections, moduleInstances},
      } as unknown as Partial<S>);
    },
```

(The `subsystems` bucket itself is still not read here — `graphData.subsystems`
above is whatever already exists, unmodified by this task. Task 26 adds the
upsert/remove loop for that bucket and reorders it *before* the link loop, so
a link endpoint that is a subsystem newly introduced in the same response
also resolves — see that task's note.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: PASS, both new tests green, and every test from Task 24 and the
pre-existing `loadGraphData` suite still green.

- [ ] **Step 5: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS, same `ModuleInstance.id` prerequisite as Task 24.

- [ ] **Step 6: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/graph-data-slice.ts \
          packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts
  git commit -m "feat(react): extend applyAddedCollection/applyDeletedCollection to links" \
             -m "upsertLink/removeLink merge a ComponentCollectionDto's" \
             -m "dataLinks/controlLinks buckets into GraphDataSlice.connections" \
             -m "(core-edit-session-design.md LLD 6.3). resolveEndpointSystemId" \
             -m "resolves a link's numeric sourceId/destinationId against both" \
             -m "moduleInstances and subsystems, since a link endpoint can be" \
             -m "either kind (REQ-027's cross-subsystem bridge hop)." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 26: Extend to the optional subsystems bucket (`upsertSubsystem`/`removeSubsystem`)

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts` (add cases to the existing file)
- Modify: `packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s
Response Reconciliation section — the `subsystems` bucket is present only on
the `-with-subsystems` endpoint variant (§7's endpoint table); when present,
its entries are merged into `GraphDataSlice.subsystems` the same way the
`spfModules`/link buckets are merged into `moduleInstances`/`connections`
(Tasks 24–25). This is the last of the three buckets and the last of the six
named helper functions (`upsertSubsystem`/`removeSubsystem`) this chapter's
scope statement calls for — after this task, `applyAddedCollection`/
`applyDeletedCollection` are complete or Part 1's purposes.

**Subsystem upserts now run *before* the link loop, not after — this
reorders Task 25's version, it does not just append to it.** The original
design-doc sketch (`core-edit-session-design.md`'s inline
`applyComponentCollection` listing) processes subsystems in its own loop
*after* both link loops. That ordering was written for a single flat
function; it does not carry over correctly to this chapter's two-function
split, where `applyAddedCollection` must resolve a link endpoint that is a
**subsystem newly introduced in the very same collection** (a
`-with-subsystems` link-create response can return both the new link and
the subsystem it terminates at in the one collection) — exactly the same
same-response-resolution case Task 25's own doc comment already covers for
newly-created *modules*. Subsystems must therefore be upserted before the
link loop runs, the same relative position modules already have. This task
shows the full, reordered bodies of both actions rather than a diff, since
the change is a reordering, not a pure addition.

**`Subsystem.subgraphs` is preserved on update, not recomputed.** The real
`Subsystem.subgraphs: string[]` field is populated by `loadGraphData` via a
full-snapshot grouping of every `SpfModuleDto.parentId` — a computation this
incremental path has no equivalent input for (an incremental
`ComponentCollectionDto` never carries the full module set, and
`ModuleInstance` itself carries no "which subsystem is this module under"
field at all, confirmed by reading the interface). Recomputing this
membership list correctly on every subsystem upsert is out of scope for this
task (and not something either chapter half of this batch attempts) — so
`toSubsystem` below carries the previous `Subsystem.subgraphs` forward
unchanged when updating an existing entry, and defaults to `[]` only for a
subsystem that didn't previously exist, the same treatment `toModuleInstance`
(Task 24) gives `position`.

- [ ] **Step 1: Write the failing test**

Hoist this fixture builder to file scope alongside `makeSpfModuleDto`/
`makeDataLinkDto`:

```typescript
import type {
  ComponentCollectionDto,
  ControlLinkDto,
  DataLinkDto,
  SpfModuleDto,
  SubsystemDto,
} from '~entities/usecases/model/usecase-component.dto';

function makeSubsystemDto(overrides: Partial<SubsystemDto> = {}): SubsystemDto {
  return {
    changeInfo: {changeType: 'CREATE'},
    controlPorts: [],
    dataPorts: [],
    filteredKeys: [],
    id: 99,
    name: 'Subsystem A',
    relatedEndPointLinks: [],
    systemId: 'sys-ss-1',
    ...overrides,
  };
}
```

Then add the test cases:

```typescript
describe('applyAddedCollection / applyDeletedCollection — subsystems', () => {
  it('upserts a new subsystem into graphData.subsystems', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {},
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    store.getState().applyAddedCollection({
      controlLinks: [],
      dataLinks: [],
      spfModules: [],
      subsystems: [makeSubsystemDto()],
    });

    const ss = store.getState().graphData!.subsystems['sys-ss-1'];
    expect(ss).toBeDefined();
    expect(ss.id).toBe(99);
    expect(ss.subgraphs).toEqual([]);
  });

  it('preserves the existing subgraphs membership list when a subsystem is upserted again', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {},
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {
          'sys-ss-1': {
            controlPorts: [],
            dataPorts: [],
            id: 99,
            subgraphs: ['subgraph-1', 'subgraph-2'],
            subsystemId: 'sys-ss-1',
            subsystemName: 'Subsystem A',
          },
        },
      },
    });

    store.getState().applyAddedCollection({
      controlLinks: [],
      dataLinks: [],
      spfModules: [],
      subsystems: [makeSubsystemDto({name: 'Subsystem A Renamed'})],
    });

    const ss = store.getState().graphData!.subsystems['sys-ss-1'];
    expect(ss.subsystemName).toBe('Subsystem A Renamed');
    expect(ss.subgraphs).toEqual(['subgraph-1', 'subgraph-2']);
  });

  it('removes a subsystem via applyDeletedCollection', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {},
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {
          'sys-ss-1': {
            controlPorts: [],
            dataPorts: [],
            id: 99,
            subgraphs: [],
            subsystemId: 'sys-ss-1',
            subsystemName: 'Subsystem A',
          },
        },
      },
    });

    store.getState().applyDeletedCollection({
      controlLinks: [],
      dataLinks: [],
      spfModules: [],
      subsystems: [makeSubsystemDto()],
    });

    expect(
      store.getState().graphData!.subsystems['sys-ss-1'],
    ).toBeUndefined();
  });

  it('resolves a link endpoint against a subsystem newly added in the same collection (upsert ordering)', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {
          'sys-mod-1': {
            containerId: '10',
            displayName: 'AudioDecoder',
            id: 1,
            inputPorts: [],
            moduleId: '200',
            moduleInstanceId: 'sys-mod-1',
            moduleName: 'AudioDecoder',
            moduleType: '',
            outputPorts: [],
            position: {x: 0, y: 0},
            subgraphId: '1',
          },
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    store.getState().applyAddedCollection({
      controlLinks: [],
      dataLinks: [
        makeDataLinkDto({destinationId: 99, sourceId: 1, systemId: 'link-1'}),
      ],
      spfModules: [],
      subsystems: [makeSubsystemDto()],
    });

    const conn = store
      .getState()
      .graphData!.connections.find((c) => c.connectionId === 'link-1');
    expect(conn?.toModuleId).toBe('sys-ss-1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: FAIL — the first three assertions fail because
`collection.subsystems` is never read yet (`ss` is `undefined`,
`applyDeletedCollection` leaves the subsystem in place); the fourth fails
because, with Task 25's ordering, the link loop runs before any subsystem
exists to resolve against, so `conn?.toModuleId` is `'99'`
(the numeric-id string fallback), not `'sys-ss-1'`.

- [ ] **Step 3: Implement `toSubsystem`, `upsertSubsystem`, `removeSubsystem`, and reorder both actions**

Add the DTO import (merge with Tasks 24–25's import block):

```typescript
import type {
  ComponentCollectionDto,
  ControlLinkDto,
  DataLinkDto,
  SpfModuleDto,
  SubsystemDto,
} from '~entities/usecases/model/usecase-component.dto';
```

Add these standalone functions below `removeLink` (Task 25):

```typescript
/**
 * Maps one `SubsystemDto` to a `Subsystem`, the same port-mapping
 * `loadGraphData` already does for subsystems. `subgraphs` (the derived
 * membership list `loadGraphData` computes from a full `spfModules` grouping
 * this incremental path doesn't have) is carried forward from `existing`
 * rather than recomputed — see this task's Spec note.
 */
function toSubsystem(
  ss: SubsystemDto,
  existing: Subsystem | undefined,
): Subsystem {
  return {
    controlPorts: (ss.controlPorts ?? []).map((p) => ({
      direction: 'input' as const,
      portId: p.systemId,
      portName: p.controlPortName,
      portType: 'control' as const,
    })),
    dataPorts: (ss.dataPorts ?? []).map((p) => ({
      direction: p.portIoType === 'Input' ? 'input' : 'output',
      portId: p.systemId,
      portName: p.name,
      portType: 'data' as const,
    })),
    id: ss.id,
    subgraphs: existing?.subgraphs ?? [],
    subsystemId: ss.systemId,
    subsystemName: ss.name,
  };
}

function upsertSubsystem(
  subsystems: Record<string, Subsystem>,
  ss: SubsystemDto,
): Record<string, Subsystem> {
  return {
    ...subsystems,
    [ss.systemId]: toSubsystem(ss, subsystems[ss.systemId]),
  };
}

function removeSubsystem(
  subsystems: Record<string, Subsystem>,
  ss: SubsystemDto,
): Record<string, Subsystem> {
  const next = {...subsystems};
  delete next[ss.systemId];
  return next;
}
```

Replace `applyAddedCollection`/`applyDeletedCollection`'s bodies once more
with these final versions (subsystems upserted/removed between modules and
links):

```typescript
    applyAddedCollection: (collection: ComponentCollectionDto): void => {
      const {graphData, moduleList} = get();
      if (!graphData) {
        return;
      }
      const defModuleTypeById = new Map(
        moduleList.map((d) => [d.moduleId, d.moduleType]),
      );
      let moduleInstances = graphData.moduleInstances;
      for (const m of collection.spfModules) {
        moduleInstances = upsertModule(
          moduleInstances,
          m,
          defModuleTypeById.get(String(m.moduleId)) ?? '',
        );
      }
      let subsystems = graphData.subsystems;
      for (const ss of collection.subsystems ?? []) {
        subsystems = upsertSubsystem(subsystems, ss);
      }
      let connections = graphData.connections;
      for (const l of collection.dataLinks) {
        connections = upsertLink(
          moduleInstances,
          subsystems,
          connections,
          l,
          'data',
        );
      }
      for (const l of collection.controlLinks) {
        connections = upsertLink(
          moduleInstances,
          subsystems,
          connections,
          l,
          'control',
        );
      }
      logger.debug('graphDataSlice: applyAddedCollection', {
        action: 'applyAddedCollection',
        component: 'graphDataSlice',
      });
      set({
        graphData: {...graphData, connections, moduleInstances, subsystems},
      } as unknown as Partial<S>);
    },

    applyDeletedCollection: (collection: ComponentCollectionDto): void => {
      const {graphData} = get();
      if (!graphData) {
        return;
      }
      let moduleInstances = graphData.moduleInstances;
      for (const m of collection.spfModules) {
        moduleInstances = removeModule(moduleInstances, m);
      }
      let subsystems = graphData.subsystems;
      for (const ss of collection.subsystems ?? []) {
        subsystems = removeSubsystem(subsystems, ss);
      }
      let connections = graphData.connections;
      for (const l of collection.dataLinks) {
        connections = removeLink(connections, l);
      }
      for (const l of collection.controlLinks) {
        connections = removeLink(connections, l);
      }
      logger.debug('graphDataSlice: applyDeletedCollection', {
        action: 'applyDeletedCollection',
        component: 'graphDataSlice',
      });
      set({
        graphData: {...graphData, connections, moduleInstances, subsystems},
      } as unknown as Partial<S>);
    },
```

This completes both actions for Part 1's scope: `applyAddedCollection`
upserts modules, then subsystems, then links (data, then control);
`applyDeletedCollection` removes the same three in the same order (order is
immaterial for removal itself — `removeLink` only filters by `systemId` —
but kept parallel to the added path for readability). All six named helpers
(`upsertModule`/`removeModule`/`upsertLink`/`removeLink`/`upsertSubsystem`/
`removeSubsystem`) now exist.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: PASS, all four new tests green, and every test from Tasks 24–25
and the pre-existing `loadGraphData` suite still green.

- [ ] **Step 5: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS, same `ModuleInstance.id` prerequisite as Tasks 24–25.

- [ ] **Step 6: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/graph-data-slice.ts \
          packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts
  git commit -m "feat(react): extend applyAddedCollection/applyDeletedCollection to subsystems" \
             -m "upsertSubsystem/removeSubsystem merge a ComponentCollectionDto's" \
             -m "optional subsystems bucket into GraphDataSlice.subsystems" \
             -m "(core-edit-session-design.md LLD 6.3), completing this chapter's" \
             -m "six upsert/remove helpers. Subsystem upserts now run before the" \
             -m "link loop (reordered from the prior task) so a link endpoint" \
             -m "that is a subsystem newly introduced in the same collection" \
             -m "resolves correctly. Subsystem.subgraphs is carried forward" \
             -m "unchanged on update, not recomputed — this incremental path" \
             -m "has no full-module-set input to derive it from." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.
### Task 30: `ModuleInstance.id` — the numeric primary key `adjustPortForLink` resolves link endpoints by

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`

**Spec:** `docs/graph-designer-edit/design/canvas-ui-mechanics-design.md`'s Port
Coloring section, `adjustPortForLink`'s own comment: "sourceId/destinationId
are numeric backend IDs — resolve to the module's own systemId the same way
`loadGraphData`'s `numericIdToSystemId` map already does." That map is a
`loadGraphData`-local variable, rebuilt fresh from a full `spfModules` fetch
on every load — it does not exist once `loadGraphData` returns, and the
incremental reconciler (Task 33's `findModuleByNumericId`) has no full
`spfModules` array to rebuild it from; it only has whatever arrived in one
response's three buckets, plus whatever `moduleInstances` already holds from
before. **This is a real prerequisite gap this chapter must close, the same
kind of gap Task 2 of Tasks 1–4 closed for `totalLinksAtPort`:**
`ModuleInstance` (`graph-data-slice.ts`) has no field carrying the DTO's own
numeric `id` at all today — confirmed by reading the interface and its one
construction site (`loadGraphData`'s module-mapping loop) — so there is
nothing for `findModuleByNumericId` to search against without adding one.
`Subsystem` already carries this exact field (`id: number`, "Numeric primary
key from the DTO" — see the existing doc comment a few lines above
`ModuleInstance` in the same file); this task gives `ModuleInstance` the same
treatment, not a new pattern.

This is a type-only change plus its one construction-site update — verified
by `tsc` plus the existing `graph-data-slice.test.ts` suite, not a new test
file (same shape as Task 2, which this task directly
mirrors).

- [ ] **Step 1: Add `id` to the `ModuleInstance` interface**

In `packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`,
modify the existing `ModuleInstance` interface:

```typescript
export interface ModuleInstance {
  containerId: string;
  diffChangedFields?: string[];
  diffState?: DiffState;
  displayName: string;
  /** Numeric primary key from the DTO (`SpfModuleDto.id`) — distinct from
   *  `moduleInstanceId` (the string `systemId`). Needed to resolve a link's
   *  numeric `sourceId`/`destinationId` back to its endpoint module, since
   *  those fields on `DataLinkDto`/`ControlLinkDto` are never the string
   *  `systemId` (canvas-ui-mechanics-design.md's Port Coloring section). */
  id: number;
  inputPorts: Port[];
  moduleId: string;
  moduleInstanceId: string;
  moduleName: string;
  moduleType: string;
  outputPorts: Port[];
  position: {x: number; y: number};
  subgraphId: string;
}
```

- [ ] **Step 2: Populate the field at `loadGraphData`'s module-construction site**

In the same file, `loadGraphData`'s module-mapping loop builds one `instance:
ModuleInstance` object literal per `m` in `spfModules`. Add `id: m.id` to
that object literal (alongside `containerId`/`displayName`/etc.):

```typescript
const instance: ModuleInstance = {
  containerId: String(m.containerId),
  displayName: m.alias || m.name,
  id: m.id,
  inputPorts: [...inputPorts, ...controlPorts],
  moduleId: String(m.moduleId),
  moduleInstanceId: m.systemId,
  moduleName: m.name,
  moduleType: defModuleTypeById.get(String(m.moduleId)) ?? '',
  outputPorts,
  position: {x: 0, y: 0},
  subgraphId: String(m.subgraphId),
};
```

(This is the same object literal `numericIdToSystemId.set(m.id, m.systemId)`,
a few lines above it in the same loop, already reads `m.id` from — this task
just also copies that already-available value onto the instance itself.)

- [ ] **Step 3: Run the existing graph-data-slice tests to verify nothing broke**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: PASS, all existing tests green — the added field is additive and no
current assertion inspects `ModuleInstance` shape exhaustively.

- [ ] **Step 4: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/graph-data-slice.ts
  git commit -m "feat(react): add numeric id to ModuleInstance" \
             -m "Mirrors Subsystem.id — carries SpfModuleDto's own numeric" \
             -m "primary key onto ModuleInstance, populated at loadGraphData's" \
             -m "existing module-mapping site. Prerequisite for" \
             -m "findModuleByNumericId, which the response-reconciliation" \
             -m "orchestrator (core-edit-session-design.md, LLD 6.3) needs to" \
             -m "resolve a link's numeric sourceId/destinationId back to its" \
             -m "endpoint module." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 31: `recomputeContainersAndSubgraphs` — extract the shared grouping helper

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts` (add cases to the existing file)
- Modify: `packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s
Response Reconciliation section: `recomputeContainersAndSubgraphs`
"generalizes and extends the existing `loadGraphData` grouping logic rather
than replacing it." Reading `loadGraphData` (`graph-data-slice.ts`) confirms
this **is** extractable with a light rewrite, not something requiring a
from-scratch reimplementation: the existing containers/subgraphs derivation
(two loops immediately after the module-mapping loop) groups from
`SpfModuleDto[]`'s `containerId`/`subgraphId`/`changeInfo?.changeType`
fields — and `ModuleInstance` (the mapped, already-built form) carries every
one of those same three facts as `containerId`/`subgraphId`/`diffState`. So
the grouping logic is rewritten once, driven by `Record<string,
ModuleInstance>` instead of raw `SpfModuleDto[]`, as a standalone pure
function both `loadGraphData` (which already has a `moduleInstances` record
built by the time it currently runs this derivation) and the new
`recomputeContainersAndSubgraphs` action call — eliminating the duplication
the design doc's "generalizes and extends" phrasing warns against, rather
than leaving a second, drifting copy.

Per this chapter's explicit scope, this task does **not** touch
`subgraphProvenanceById`/`kvCasesById` stamping or pruning — those belong to
`node-operations-design.md`'s own chapter. This function only re-derives
`containers`/`subgraphs` from surviving modules.

- [ ] **Step 1: Write the failing test**

Add to the end of the `describe` block in
`packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts`
(reuse whatever fixture/`makeStore` helpers the existing file already
defines for `loadGraphData` tests — omitted below for brevity where they
already exist in that file):

```typescript
describe('recomputeContainersAndSubgraphs', () => {
  it('re-derives containers/subgraphs from moduleInstances, dropping any that no longer have a surviving module', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {
          'old-container': {
            containerId: 'old-container',
            containerName: 'stale',
            moduleInstances: ['gone-module'],
            subgraphId: 'old-subgraph',
          },
        },
        moduleInstances: {
          'mod-1': {
            containerId: 'container-1',
            displayName: 'Mod 1',
            id: 1,
            inputPorts: [],
            moduleId: '100',
            moduleInstanceId: 'mod-1',
            moduleName: 'Mod 1',
            moduleType: '',
            outputPorts: [],
            position: {x: 0, y: 0},
            subgraphId: 'subgraph-1',
          },
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    store.getState().recomputeContainersAndSubgraphs();

    const {containers, subgraphs} = store.getState().graphData!;
    expect(Object.keys(containers)).toEqual(['container-1']);
    expect(containers['container-1'].moduleInstances).toEqual(['mod-1']);
    expect(Object.keys(subgraphs)).toEqual(['subgraph-1']);
    expect(subgraphs['subgraph-1'].containers).toEqual(['container-1']);
  });

  it('carries a module diffState onto its subgraph', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {
          'mod-1': {
            containerId: 'container-1',
            diffState: 'added',
            displayName: 'Mod 1',
            id: 1,
            inputPorts: [],
            moduleId: '100',
            moduleInstanceId: 'mod-1',
            moduleName: 'Mod 1',
            moduleType: '',
            outputPorts: [],
            position: {x: 0, y: 0},
            subgraphId: 'subgraph-1',
          },
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    store.getState().recomputeContainersAndSubgraphs();

    expect(store.getState().graphData!.subgraphs['subgraph-1'].diffState).toBe(
      'added',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: FAIL — `TypeError: store.getState().recomputeContainersAndSubgraphs
is not a function` (the action doesn't exist yet).

- [ ] **Step 3: Extract `deriveContainersAndSubgraphs` and replace `loadGraphData`'s inline loops**

In `graph-data-slice.ts`, add this standalone function near the top of the
file (below the type declarations, above `createGraphDataSlice`):

```typescript
/**
 * Groups surviving modules into their containers/subgraphs. Shared by
 * `loadGraphData` (full snapshot) and `recomputeContainersAndSubgraphs`
 * (incremental reconciliation, core-edit-session-design.md LLD §6.3) — the
 * only difference between the two call sites is *when* it runs, not how
 * the grouping itself works, so both drive it from the same already-mapped
 * `ModuleInstance` records rather than each keeping its own copy of the
 * grouping loop.
 */
function deriveContainersAndSubgraphs(
  moduleInstances: Record<string, ModuleInstance>,
): {containers: Record<string, Container>; subgraphs: Record<string, Subgraph>} {
  const containers: Record<string, Container> = {};
  const subgraphs: Record<string, Subgraph> = {};

  for (const [moduleInstanceId, m] of Object.entries(moduleInstances)) {
    if (!(m.containerId in containers)) {
      containers[m.containerId] = {
        containerId: m.containerId,
        containerName: `Container ${m.containerId}`,
        moduleInstances: [],
        subgraphId: m.subgraphId,
      };
    }
    containers[m.containerId].moduleInstances.push(moduleInstanceId);

    if (!(m.subgraphId in subgraphs)) {
      subgraphs[m.subgraphId] = {
        containers: [],
        subgraphId: m.subgraphId,
        subgraphName: `Subgraph ${m.subgraphId}`,
        subgraphType: '',
      };
    }
    const sg = subgraphs[m.subgraphId];
    if (!sg.containers.includes(m.containerId)) {
      sg.containers.push(m.containerId);
    }
    if (m.diffState && !sg.diffState) {
      sg.diffState = m.diffState;
    }
  }

  return {containers, subgraphs};
}
```

Then, in `loadGraphData`, replace the two inline "containers — derived by
grouping..." / "subgraphs — derived by grouping..." loops (the code
immediately after the module-mapping loop that builds `moduleInstances`,
before the `subsystems` derivation) with:

```typescript
const {containers, subgraphs} = deriveContainersAndSubgraphs(moduleInstances);
```

Everything downstream (`subsystems` derivation, the final `graphData`
object literal) is unchanged — `containers`/`subgraphs` are still the same
two `const` bindings those later lines already reference, now produced by
the shared function instead of two inline loops.

- [ ] **Step 4: Add the `recomputeContainersAndSubgraphs` action**

Add to the `GraphDataSlice` interface, in alphabetical order:

```typescript
  recomputeContainersAndSubgraphs: () => void;
```

Add to `createGraphDataSlice`'s returned object, in alphabetical order:

```typescript
    recomputeContainersAndSubgraphs: (): void => {
      const {graphData} = get();
      if (!graphData) {
        return;
      }
      const {containers, subgraphs} = deriveContainersAndSubgraphs(
        graphData.moduleInstances,
      );
      logger.debug('graphDataSlice: recomputeContainersAndSubgraphs', {
        action: 'recomputeContainersAndSubgraphs',
        component: 'graphDataSlice',
      });
      set({
        graphData: {...graphData, containers, subgraphs},
      } as unknown as Partial<S>);
    },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: PASS, both new tests green, and every pre-existing `loadGraphData`
test in this file still green (confirming the extraction changed no
observable behavior of `loadGraphData` itself).

- [ ] **Step 6: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 7: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/graph-data-slice.ts \
          packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts
  git commit -m "feat(react): extract shared container/subgraph grouping" \
             -m "deriveContainersAndSubgraphs replaces loadGraphData's two" \
             -m "inline grouping loops with one function driven by" \
             -m "ModuleInstance records, and a new recomputeContainersAndSubgraphs" \
             -m "action reuses it for incremental reconciliation" \
             -m "(core-edit-session-design.md LLD 6.3) — containers/subgraphs" \
             -m "are never first-class response entities, so they must be" \
             -m "re-derived after every add/update/delete the same way they" \
             -m "are derived on initial load." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 32: `pruneDeletedLinkBookkeeping` — prune `pairLinksById`/`excludedLinks` for deleted links

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts` (add cases to the existing file)
- Modify: `packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s
Response Reconciliation section: "`pairLinksById`/`excludedLinks` are pruned
by `applyComponentCollection` itself... a direct lookup against that one
collection's own `dataLinks`/`controlLinks`, not something that needs the
before/after subgraph-set comparison the provenance map requires." Explicit
chapter scope: this task implements **only** this link-bookkeeping pruning —
`subgraphProvenanceById`/`kvCasesById` pruning is a different design doc's
chapter and is not touched here. `pairLinksById`/`excludedLinks` are declared
on `EditSessionSlice` by Task 18
(`pairLinksById: Map<string, SubgraphPairDto>`, `excludedLinks: Connection[]`).

**This task broadens `createGraphDataSlice`'s generic constraint.** Today it
is `S extends GraphDataSlice & ModuleListSlice` (`loadGraphData` reads
`get().moduleList`, added by `ModuleListSlice`). This function additionally
needs `get().pairLinksById`/`get().excludedLinks`, so the constraint becomes
`S extends GraphDataSlice & ModuleListSlice & EditSessionSlice` — the same
kind of cross-slice read `loadGraphData` already established the pattern
for, just against a second sibling slice. `EditSessionSlice` is imported
type-only from `./edit-session-slice`; that file already imports `type
{Connection}` from this file (Task 18), so this is
a type-only circular import between the two files — safe, since `import
type` is fully erased at compile time and creates no runtime circular
dependency.

- [ ] **Step 1: Write the failing test**

Add to `packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts`:

```typescript
describe('pruneDeletedLinkBookkeeping', () => {
  it('removes deleted link ids from pairLinksById and excludedLinks, leaving survivors untouched', () => {
    const store = makeStore();
    store.setState({
      excludedLinks: [
        {
          connectionId: 'link-deleted',
          connectionType: 'data',
          fromModuleId: 'm1',
          fromPortId: 'p1',
          toModuleId: 'm2',
          toPortId: 'p2',
        },
        {
          connectionId: 'link-survivor',
          connectionType: 'data',
          fromModuleId: 'm3',
          fromPortId: 'p3',
          toModuleId: 'm4',
          toPortId: 'p4',
        },
      ],
      pairLinksById: new Map([
        [
          'link-deleted',
          {
            connectionType: 'data' as const,
            fromModuleId: 'm1',
            fromPortId: 'p1',
            id: 'link-deleted',
            sourceSubgraphId: 'sg-1',
            targetSubgraphId: 'sg-2',
            toModuleId: 'm2',
            toPortId: 'p2',
          },
        ],
        [
          'link-survivor',
          {
            connectionType: 'data' as const,
            fromModuleId: 'm3',
            fromPortId: 'p3',
            id: 'link-survivor',
            sourceSubgraphId: 'sg-1',
            targetSubgraphId: 'sg-2',
            toModuleId: 'm4',
            toPortId: 'p4',
          },
        ],
      ]),
    });

    store.getState().pruneDeletedLinkBookkeeping({
      controlLinks: [],
      dataLinks: [makeDataLinkDto({systemId: 'link-deleted'})],
      spfModules: [],
    });

    expect(store.getState().pairLinksById.has('link-deleted')).toBe(false);
    expect(store.getState().pairLinksById.has('link-survivor')).toBe(true);
    expect(
      store.getState().excludedLinks.map((l) => l.connectionId),
    ).toEqual(['link-survivor']);
  });

  it('is a no-op when the deleted bucket has no links', () => {
    const store = makeStore();
    const before = store.getState();

    store.getState().pruneDeletedLinkBookkeeping({
      controlLinks: [],
      dataLinks: [],
      spfModules: [],
    });

    expect(store.getState().pairLinksById).toBe(before.pairLinksById);
    expect(store.getState().excludedLinks).toBe(before.excludedLinks);
  });
});
```

This test assumes a `makeDataLinkDto(overrides)` fixture builder already
exists in this test file (building a minimal valid `DataLinkDto` with
sensible defaults for every other required field) — add one colocated with
the other fixture helpers in this file if it does not already exist:

```typescript
function makeDataLinkDto(overrides: Partial<DataLinkDto> = {}): DataLinkDto {
  return {
    changeInfo: {changeType: 'DELETE'},
    connectionType: 'DataConnection',
    destinationId: 2,
    destinationPortId: 20,
    isDangling: false,
    name: 'link',
    relatedEndPointLinks: [],
    sourceId: 1,
    sourcePortId: 10,
    systemId: 'link-1',
    ...overrides,
  };
}
```

Adjust `connectionType`'s literal value and `ChangeInfoDto`'s required
fields to match whatever `ConnectionType`/`ChangeInfoDto` actually declare in
`usecase-component.dto.ts` if this differs from the placeholder values
above — the exact enum values aren't load-bearing for this test, only
`systemId` is asserted against.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: FAIL — `TypeError: store.getState().pruneDeletedLinkBookkeeping is
not a function`.

- [ ] **Step 3: Broaden the generic constraint and add the action**

At the top of `graph-data-slice.ts`, add the new imports:

```typescript
import type {
  ComponentCollectionDto,
} from '~entities/usecases/model/usecase-component.dto';

import type {EditSessionSlice} from './edit-session-slice';
```

Change `createGraphDataSlice`'s signature:

```typescript
export function createGraphDataSlice<
  S extends GraphDataSlice & ModuleListSlice & EditSessionSlice,
>(
```

Add to the `GraphDataSlice` interface, in alphabetical order:

```typescript
  pruneDeletedLinkBookkeeping: (deleted: ComponentCollectionDto) => void;
```

Add to `createGraphDataSlice`'s returned object, in alphabetical order:

```typescript
    pruneDeletedLinkBookkeeping: (deleted: ComponentCollectionDto): void => {
      const deletedLinkIds = new Set([
        ...deleted.dataLinks.map((l) => l.systemId),
        ...deleted.controlLinks.map((l) => l.systemId),
      ]);
      if (deletedLinkIds.size === 0) {
        return;
      }
      logger.debug('graphDataSlice: pruneDeletedLinkBookkeeping', {
        action: 'pruneDeletedLinkBookkeeping',
        component: 'graphDataSlice',
        count: deletedLinkIds.size,
      });
      const {excludedLinks, pairLinksById} = get();
      const nextPairLinksById = new Map(pairLinksById);
      for (const linkId of deletedLinkIds) {
        nextPairLinksById.delete(linkId);
      }
      set({
        excludedLinks: excludedLinks.filter(
          (l) => !deletedLinkIds.has(l.connectionId),
        ),
        pairLinksById: nextPairLinksById,
      } as unknown as Partial<S>);
    },
```

A fresh `Map` is built (via `new Map(pairLinksById)` then targeted
`.delete()` calls) rather than mutating the existing one in place, matching
Task 19 convention for this same field
(`resetSessionLocalMaps`) of always producing a new instance for `set()`
rather than relying on in-place mutation of a value React/Zustand consumers
may hold a stale reference to.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: PASS, both new tests green.

- [ ] **Step 5: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS once composed with `EditSessionSlice`'s own fields
(Task 18/19) — `createGraphDataSlice`'s call site
in `graph-designer-store.ts` already passes the fully-composed `set`/`get`
typed to the whole `GraphDesignerStore`, so broadening the constraint here
requires no change at the call site itself.

- [ ] **Step 6: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/graph-data-slice.ts \
          packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts
  git commit -m "feat(react): prune pairLinksById/excludedLinks on link delete" \
             -m "pruneDeletedLinkBookkeeping drops any deleted bucket's link" \
             -m "systemId from both EditSessionSlice maps — a direct lookup" \
             -m "against the response's own dataLinks/controlLinks, no" \
             -m "before/after diffing needed (core-edit-session-design.md" \
             -m "LLD 6.3). Broadens createGraphDataSlice's generic" \
             -m "constraint to include EditSessionSlice." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 33: `adjustSurvivingPortCounts`/`adjustPortForLink` — `totalLinksAtPort` correction

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts` (add cases to the existing file)
- Modify: `packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`

**Spec:** `docs/graph-designer-edit/design/canvas-ui-mechanics-design.md`'s
Port Coloring section (REQ-064) — `adjustSurvivingPortCounts`/
`adjustPortForLink` are designed there in full; this task implements them
against this codebase's real `ModuleInstance`/`Port` shapes (Task 30 already
added the `id` field `findModuleByNumericId` needs) rather than the design
doc's `GraphDesignerStore`-shaped pseudocode directly, since this store has
no Immer middleware — mutating a port object in place, as the design doc's
own sketch does (`port.totalLinksAtPort += delta`), would mutate the live
Zustand state object without any `set()` call ever running, so components
subscribed via reference-equality selectors would never re-render. This task
instead builds a new `ModuleInstance`/`Port` object for every endpoint that
changes and commits once via `set()`, consistent with every other action in
this file (`recomputeContainersAndSubgraphs`, Task 31, does the same for
`containers`/`subgraphs`).

Per the design doc: a link endpoint that resolves to `undefined` — either
because it was itself deleted in the same response (already removed from
`moduleInstances` by the time this runs) or because it is a subsystem, not a
module (REQ-027's cross-subsystem bridge hop) — is silently skipped, not an
error. This function is module-port-only, per REQ-064.

- [ ] **Step 1: Write the failing test**

Add to `packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts`:

```typescript
describe('adjustSurvivingPortCounts', () => {
  function moduleWithPort(overrides: {
    id: number;
    moduleInstanceId: string;
    portId: string;
    totalLinksAtPort: number;
  }): ModuleInstance {
    return {
      containerId: 'c1',
      displayName: 'M',
      id: overrides.id,
      inputPorts: [
        {
          direction: 'input',
          isStatic: false,
          portId: overrides.portId,
          portName: 'in',
          portType: 'data',
          totalLinksAtPort: overrides.totalLinksAtPort,
        },
      ],
      moduleId: '1',
      moduleInstanceId: overrides.moduleInstanceId,
      moduleName: 'M',
      moduleType: '',
      outputPorts: [],
      position: {x: 0, y: 0},
      subgraphId: 'sg-1',
    };
  }

  it('increments totalLinksAtPort on both endpoints of an added link', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {
          'mod-src': moduleWithPort({
            id: 1,
            moduleInstanceId: 'mod-src',
            portId: 'port-src',
            totalLinksAtPort: 0,
          }),
          'mod-dst': moduleWithPort({
            id: 2,
            moduleInstanceId: 'mod-dst',
            portId: 'port-dst',
            totalLinksAtPort: 1,
          }),
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    store.getState().adjustSurvivingPortCounts(
      [
        makeDataLinkDto({
          destinationId: 2,
          destinationPortId: Number('port-dst'.replace(/\D/g, '') || 0),
          sourceId: 1,
          sourcePortId: Number('port-src'.replace(/\D/g, '') || 0),
        }),
      ],
      [],
    );

    // Ports are matched by String(portNumericId) === port.portId, so this
    // test uses numeric-looking port ids directly rather than the
    // descriptive strings above — see the corrected fixture in Step 1b.
  });
});
```

**Step 1b — correct the fixture to use numeric-looking port ids** (the
inline `.replace(/\D/g, '')` above is a placeholder to flag the constraint;
replace the whole test with this corrected version instead of the draft
above):

```typescript
describe('adjustSurvivingPortCounts', () => {
  function moduleWithPort(overrides: {
    id: number;
    moduleInstanceId: string;
    portId: string;
    totalLinksAtPort: number;
  }): ModuleInstance {
    return {
      containerId: 'c1',
      displayName: 'M',
      id: overrides.id,
      inputPorts: [
        {
          direction: 'input',
          isStatic: false,
          portId: overrides.portId,
          portName: 'in',
          portType: 'data',
          totalLinksAtPort: overrides.totalLinksAtPort,
        },
      ],
      moduleId: '1',
      moduleInstanceId: overrides.moduleInstanceId,
      moduleName: 'M',
      moduleType: '',
      outputPorts: [],
      position: {x: 0, y: 0},
      subgraphId: 'sg-1',
    };
  }

  it('increments totalLinksAtPort on both endpoints of an added link', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {
          'mod-dst': moduleWithPort({
            id: 2,
            moduleInstanceId: 'mod-dst',
            portId: '20',
            totalLinksAtPort: 1,
          }),
          'mod-src': moduleWithPort({
            id: 1,
            moduleInstanceId: 'mod-src',
            portId: '10',
            totalLinksAtPort: 0,
          }),
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    store.getState().adjustSurvivingPortCounts(
      [makeDataLinkDto({destinationId: 2, destinationPortId: 20, sourceId: 1, sourcePortId: 10})],
      [],
    );

    const {moduleInstances} = store.getState().graphData!;
    expect(moduleInstances['mod-src'].inputPorts[0].totalLinksAtPort).toBe(1);
    expect(moduleInstances['mod-dst'].inputPorts[0].totalLinksAtPort).toBe(2);
  });

  it('decrements totalLinksAtPort on both endpoints of a deleted link', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {
          'mod-dst': moduleWithPort({
            id: 2,
            moduleInstanceId: 'mod-dst',
            portId: '20',
            totalLinksAtPort: 2,
          }),
          'mod-src': moduleWithPort({
            id: 1,
            moduleInstanceId: 'mod-src',
            portId: '10',
            totalLinksAtPort: 1,
          }),
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    store.getState().adjustSurvivingPortCounts(
      [],
      [makeDataLinkDto({destinationId: 2, destinationPortId: 20, sourceId: 1, sourcePortId: 10})],
    );

    const {moduleInstances} = store.getState().graphData!;
    expect(moduleInstances['mod-src'].inputPorts[0].totalLinksAtPort).toBe(0);
    expect(moduleInstances['mod-dst'].inputPorts[0].totalLinksAtPort).toBe(1);
  });

  it('silently skips an endpoint that no longer exists (deleted in the same cascade, or a subsystem hop)', () => {
    const store = makeStore();
    store.setState({
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {
          'mod-src': moduleWithPort({
            id: 1,
            moduleInstanceId: 'mod-src',
            portId: '10',
            totalLinksAtPort: 0,
          }),
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
    });

    expect(() =>
      store.getState().adjustSurvivingPortCounts(
        [makeDataLinkDto({destinationId: 999, destinationPortId: 20, sourceId: 1, sourcePortId: 10})],
        [],
      ),
    ).not.toThrow();

    expect(
      store.getState().graphData!.moduleInstances['mod-src'].inputPorts[0]
        .totalLinksAtPort,
    ).toBe(1);
  });
});
```

Delete the earlier draft `it` block (Step 1's placeholder with the
`.replace(/\D/g, '')` comment) — Step 1b's version is the one that actually
runs; the draft exists only to explain why port ids must be numeric-looking
strings (`Port.portId` is matched via `String(portNumericId) ===
port.portId`, per the design doc's `adjustPortForLink`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: FAIL — `TypeError: store.getState().adjustSurvivingPortCounts is
not a function`.

- [ ] **Step 3: Implement `findModuleByNumericId`, `adjustPortForLink`, and `adjustSurvivingPortCounts`**

Add the DTO import (merge with Task 32's import block if both land in the
same working tree):

```typescript
import type {
  ComponentCollectionDto,
  ControlLinkDto,
  DataLinkDto,
} from '~entities/usecases/model/usecase-component.dto';
```

Add these standalone functions near `deriveContainersAndSubgraphs` (Task 31):

```typescript
function findModuleByNumericId(
  moduleInstances: Record<string, ModuleInstance>,
  numericId: number,
): ModuleInstance | undefined {
  return Object.values(moduleInstances).find((m) => m.id === numericId);
}

/**
 * Returns `module` unchanged if it has no port matching `portId`; otherwise
 * returns a new `ModuleInstance` with that one port's `totalLinksAtPort`
 * adjusted by `delta`. Never mutates `module` or any of its ports in
 * place — this store has no Immer middleware, so an in-place mutation would
 * silently fail to trigger re-renders in components subscribed via
 * reference-equality selectors.
 */
function withAdjustedPort(
  module: ModuleInstance,
  portId: string,
  delta: number,
): ModuleInstance {
  const adjust = (p: Port): Port =>
    p.portId === portId ? {...p, totalLinksAtPort: p.totalLinksAtPort + delta} : p;
  return {
    ...module,
    inputPorts: module.inputPorts.map(adjust),
    outputPorts: module.outputPorts.map(adjust),
  };
}

function adjustModuleInstancesForLink(
  moduleInstances: Record<string, ModuleInstance>,
  link: DataLinkDto | ControlLinkDto,
  delta: number,
): Record<string, ModuleInstance> {
  let next = moduleInstances;
  for (const [moduleNumericId, portNumericId] of [
    [link.sourceId, link.sourcePortId],
    [link.destinationId, link.destinationPortId],
  ] as const) {
    // undefined here means either this endpoint was itself deleted in the
    // same response's module bucket, or it's a subsystem rather than a
    // module (REQ-027's cross-subsystem bridge hop) — REQ-064 port
    // coloring is a module-port concept only, so there is nothing to
    // adjust for either case; skip, don't throw.
    const module = findModuleByNumericId(next, moduleNumericId);
    if (!module) {
      continue;
    }
    next = {
      ...next,
      [module.moduleInstanceId]: withAdjustedPort(
        module,
        String(portNumericId),
        delta,
      ),
    };
  }
  return next;
}
```

Add to the `GraphDataSlice` interface, in alphabetical order:

```typescript
  adjustSurvivingPortCounts: (
    addedLinks: Array<ControlLinkDto | DataLinkDto>,
    deletedLinks: Array<ControlLinkDto | DataLinkDto>,
  ) => void;
```

Add to `createGraphDataSlice`'s returned object, in alphabetical order:

```typescript
    adjustSurvivingPortCounts: (
      addedLinks: Array<ControlLinkDto | DataLinkDto>,
      deletedLinks: Array<ControlLinkDto | DataLinkDto>,
    ): void => {
      const {graphData} = get();
      if (!graphData) {
        return;
      }
      let moduleInstances = graphData.moduleInstances;
      for (const link of addedLinks) {
        moduleInstances = adjustModuleInstancesForLink(moduleInstances, link, +1);
      }
      for (const link of deletedLinks) {
        moduleInstances = adjustModuleInstancesForLink(moduleInstances, link, -1);
      }
      logger.debug('graphDataSlice: adjustSurvivingPortCounts', {
        action: 'adjustSurvivingPortCounts',
        addedCount: addedLinks.length,
        component: 'graphDataSlice',
        deletedCount: deletedLinks.length,
      });
      set({
        graphData: {...graphData, moduleInstances},
      } as unknown as Partial<S>);
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: PASS, all four new tests green.

- [ ] **Step 5: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 6: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/graph-data-slice.ts \
          packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts
  git commit -m "feat(react): adjust totalLinksAtPort for added/deleted links" \
             -m "adjustSurvivingPortCounts/adjustPortForLink correct" \
             -m "totalLinksAtPort on both endpoints of every added/deleted" \
             -m "link, since the backend response never carries the" \
             -m "surviving sibling module's updated port count directly" \
             -m "(canvas-ui-mechanics-design.md REQ-064). Immutable" \
             -m "reimplementation of the design doc's mutate-in-place" \
             -m "sketch — this store has no Immer middleware. Endpoints" \
             -m "that no longer resolve (deleted-in-cascade, or a REQ-027" \
             -m "subsystem hop) are silently skipped, by design." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 34: `applyComponentCollection` — the top-level reconciliation orchestrator

**Package:** `packages/react-app`

**Files:**
- Create: `packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts` (add cases to the existing file)
- Modify: `packages/react-app/src/features/graph-designer/model/graph-data-slice.ts`

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s
Response Reconciliation section (LLD §6.3): a single shared reconciler
merges all three buckets into `GraphDataSlice`, then (1) re-derives
containers/subgraphs, (2) [out of scope for this chapter — provenance/KV
stamping], (3) prunes `pairLinksById`/`excludedLinks`, (4) adjusts
`totalLinksAtPort`. This task wires the four in-scope pieces (module/link/
subsystem merge, `recomputeContainersAndSubgraphs` from Task 31,
`pruneDeletedLinkBookkeeping` from Task 32, `adjustSurvivingPortCounts` from
Task 33) into the one function every mutating action in this feature calls.

**Integration contract with Tasks 24–26.** Those tasks build `upsertModule`/
`removeModule`/`upsertLink`/`removeLink`/`upsertSubsystem`/`removeSubsystem`
(private, per-entity helpers) plus two public `GraphDataSlice` actions built
from them: `applyAddedCollection(collection)` (upserts every entity in one
collection) and `applyDeletedCollection(collection)` (removes every entity in
one collection). **This task's `applyComponentCollection` calls those two
public actions — `applyAddedCollection`/`applyDeletedCollection` apply
their bucket directly via the upsert/remove helpers and must not themselves
call `applyComponentCollection`.** (The original single-file design-doc
sketch this LLD section is based on shows `applyAddedCollection` wrapping
its argument into a 3-bucket object and calling
`applyComponentCollection({addedComponentCollectionDto: collection, ...})`
— implementing it that literally would make calling it from inside
`applyComponentCollection` here recurse infinitely. This task's version is
the canonical one: `applyAddedCollection`/`applyDeletedCollection` are
leaf-level bucket appliers, and `recomputeContainersAndSubgraphs`/
`pruneDeletedLinkBookkeeping`/`adjustSurvivingPortCounts` run exactly once
per `applyComponentCollection` call, from here.)

**The `updated` bucket needs no separate helper.** `applyAddedCollection`'s
own doc comment (Task 24) describes it as populating "only the added
bucket... for call sites that are purely additive" — but the operation it
performs per entity is an upsert (`moduleInstances[id] = ...`), which is
exactly what refreshing an already-existing "updated" entity's fields also
needs: a `Record` assignment by id is identical whether that id is new or
already present. There is no behavioral difference between "add module X"
and "update module X" once both reach `upsertModule` — only "delete module
X" differs (removal, not upsert). So `applyComponentCollection` reuses
`applyAddedCollection` for both the `added` and `updated` buckets, rather
than needing its own duplicate upsert loop or reaching into Tasks 24–26's
private helpers.

**Each call below commits its own `set()` independently — not one atomic
transaction.** This store has no middleware for cross-slice atomic updates,
and `applyAddedCollection`/`applyDeletedCollection`/
`recomputeContainersAndSubgraphs`/`pruneDeletedLinkBookkeeping`/
`adjustSurvivingPortCounts` are each already independently-callable actions
(consistent with every other action in this file). Because
`applyComponentCollection`'s own body runs synchronously and Zustand's
`set()` is applied synchronously, every `get()` inside one call already
observes the fully-merged result of every call before it — so sequencing
correctness (recompute must see every upsert/remove; prune/adjust must see
the final module set) is preserved without needing one combined transaction.

- [ ] **Step 1: Write the failing test**

Add to `packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts`
(building on the `makeDataLinkDto`/`moduleWithPort`-style fixtures from
Tasks 32/33 — reuse them rather than redefining):

```typescript
describe('applyComponentCollection', () => {
  it('merges added/updated/deleted modules and links, then recomputes containers/subgraphs, prunes link bookkeeping, and adjusts port counts in one pass', () => {
    const store = makeStore();
    store.setState({
      excludedLinks: [
        {
          connectionId: 'old-link',
          connectionType: 'data',
          fromModuleId: 'mod-old-src',
          fromPortId: '10',
          toModuleId: 'mod-old-dst',
          toPortId: '20',
        },
      ],
      graphData: {
        connections: [],
        containers: {},
        moduleInstances: {
          'mod-old-dst': moduleWithPortFixture({
            id: 2,
            moduleInstanceId: 'mod-old-dst',
            portId: '20',
            totalLinksAtPort: 1,
          }),
          'mod-old-src': moduleWithPortFixture({
            id: 1,
            moduleInstanceId: 'mod-old-src',
            portId: '10',
            totalLinksAtPort: 1,
          }),
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {},
      },
      pairLinksById: new Map([
        [
          'old-link',
          {
            connectionType: 'data' as const,
            fromModuleId: 'mod-old-src',
            fromPortId: '10',
            id: 'old-link',
            sourceSubgraphId: 'sg-1',
            targetSubgraphId: 'sg-2',
            toModuleId: 'mod-old-dst',
            toPortId: '20',
          },
        ],
      ]),
    });

    const empty = {controlLinks: [], dataLinks: [], spfModules: []};

    store.getState().applyComponentCollection({
      added: {
        ...empty,
        dataLinks: [
          makeDataLinkDto({
            destinationId: 2,
            destinationPortId: 20,
            sourceId: 1,
            sourcePortId: 10,
            systemId: 'new-link',
          }),
        ],
      },
      deleted: {
        ...empty,
        dataLinks: [makeDataLinkDto({systemId: 'old-link'})],
      },
      updated: empty,
    });

    const state = store.getState();
    // Port counts adjusted for both the new link (+1) and the removed
    // fixture link (-1) on the same two surviving endpoints:
    expect(
      state.graphData!.moduleInstances['mod-old-src'].inputPorts[0]
        .totalLinksAtPort,
    ).toBe(1);
    expect(
      state.graphData!.moduleInstances['mod-old-dst'].inputPorts[0]
        .totalLinksAtPort,
    ).toBe(1);
    // Link bookkeeping pruned for the deleted link id:
    expect(state.pairLinksById.has('old-link')).toBe(false);
    expect(state.excludedLinks).toEqual([]);
  });
});
```

This test assumes a shared `moduleWithPortFixture` helper — if Task 33's
`moduleWithPort` is still a test-file-local function rather than exported,
rename it to `moduleWithPortFixture` and hoist it to file scope (outside any
one `describe` block) in that task instead of duplicating it here, since
both this test and Task 33's tests need the same fixture shape.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: FAIL — `TypeError: store.getState().applyComponentCollection is
not a function`.

- [ ] **Step 3: Implement `applyComponentCollection`**

Add to the `GraphDataSlice` interface, in alphabetical order (immediately
before `clearGraphData`, since `applyAddedCollection`/`applyComponentCollection`/
`applyDeletedCollection` all sort together at the top of the interface once
merged with the sibling chapter's own additions):

```typescript
  applyComponentCollection: (collections: {
    added: ComponentCollectionDto;
    deleted: ComponentCollectionDto;
    updated: ComponentCollectionDto;
  }) => void;
```

Add to `createGraphDataSlice`'s returned object, in the same alphabetical
position:

```typescript
    applyComponentCollection: (collections: {
      added: ComponentCollectionDto;
      deleted: ComponentCollectionDto;
      updated: ComponentCollectionDto;
    }): void => {
      logger.debug('graphDataSlice: applyComponentCollection', {
        action: 'applyComponentCollection',
        component: 'graphDataSlice',
      });

      // 1. Merge every bucket into moduleInstances/connections/subsystems.
      //    "added" and "updated" are both pure upserts — upsertModule/
      //    upsertLink/upsertSubsystem (inside applyAddedCollection) assign
      //    by id regardless of whether the entity already existed, so
      //    refreshing an updated entity's fields needs no different
      //    codepath than adding a brand-new one. Only "deleted" differs
      //    (removal, not upsert).
      get().applyAddedCollection(collections.added);
      get().applyAddedCollection(collections.updated);
      get().applyDeletedCollection(collections.deleted);

      // 2. Containers/subgraphs are never first-class response entities —
      //    re-derive them from whichever modules survived step 1.
      get().recomputeContainersAndSubgraphs();

      // 3. pairLinksById/excludedLinks — direct lookup against the
      //    deleted bucket's own link ids, no diffing needed.
      get().pruneDeletedLinkBookkeeping(collections.deleted);

      // 4. totalLinksAtPort — the response never includes the surviving
      //    sibling endpoint's updated count directly.
      get().adjustSurvivingPortCounts(
        [...collections.added.dataLinks, ...collections.added.controlLinks],
        [
          ...collections.deleted.dataLinks,
          ...collections.deleted.controlLinks,
        ],
      );
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-data-slice.test.ts"`
Expected: PASS, the new `applyComponentCollection` test green, and every
prior test in this file (Tasks 30–33, and the pre-existing `loadGraphData`
suite) still green.

- [ ] **Step 5: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS once composed with the sibling chapter's
`applyAddedCollection`/`applyDeletedCollection` additions to the same
interface/factory.

- [ ] **Step 6: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/features/graph-designer/model/graph-data-slice.ts \
          packages/react-app/tests/features/graph-designer/graph-data-slice.test.ts
  git commit -m "feat(react): add applyComponentCollection reconciler" \
             -m "The single shared entry point every mutating structural" \
             -m "endpoint's added/updated/deleted triple flows through:" \
             -m "merges all three buckets (added/updated as upserts," \
             -m "deleted as removal), then recomputeContainersAndSubgraphs," \
             -m "pruneDeletedLinkBookkeeping, and adjustSurvivingPortCounts" \
             -m "in that order (core-edit-session-design.md LLD 6.3)." \
             -m "Provenance/kvCasesById stamping is out of scope here — a" \
             -m "separate node-operations-design.md chapter." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.
### Task 40: Integration test — exclusive lock blocks a second Graph Designer tab on the same project

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/tests/features/graph-designer/graph-designer-store.test.ts` (add cases to the existing file, created by Task 14)

**Spec:** `docs/graph-designer-edit/plans/foundation-plan-handoff.md` Batch 4 —
"Exclusive-lock behavior across two simulated Graph Designer tabs on the same
`projectId` vs. two tabs on different projects."

**Why this is a genuine gap, not a duplicate.** Reading every existing test
across the six prior chapters that touches the exclusive lock:
- Task 7 (`exclusive-lock-slice.test.ts`) and
  Task 9 (`global-store.test.ts`) test `setActiveExclusiveMode`/
  `releaseExclusiveMode` and selector reactivity directly against
  `createExclusiveLockSlice`/`useGlobalStore` — never through a second
  `EditSessionSlice`/`GraphDesignerStore` instance, so they don't exercise
  what a real second Graph Designer *tab* would do.
- Task 10
  (`edit-session-slice.test.ts`, "fails to enter edit mode … when the lock is
  already held") fakes the "another tab already holds it" precondition with
  a raw `useGlobalStore.getState().setActiveExclusiveMode(...)` call, not a
  second `createEditSessionSlice` instance — it proves the rejection path
  works when the lock is already held by *something*, not specifically by a
  second tab's own `enterEditMode()` call.
- Task 14
  (`graph-designer-store.test.ts`, "scopes the exclusive lock to the
  projectId passed at creation, not a flat flag") *does* create two real
  `createGraphDesignerStore(...)` instances and call `enterEditMode()` on
  both — but the two instances are given **different** `projectId`s
  (`'proj-gds-2'`/`'proj-gds-3'`), so both succeed. That test proves
  cross-project isolation; it never proves that two tabs pointed at the
  **same** project actually contend for the same lock.

No existing test creates two `createGraphDesignerStore(...)` instances (two
tabs) scoped to the *same* `projectId` and asserts that only one can hold
edit mode at a time. That is the missing half of the handoff's "same
project vs. different projects" comparison — the "different projects"
half is already proven by Task 14's second test, so this task adds only the
missing "same project" case rather than re-testing both halves.

- [ ] **Step 1: Write the test**

Add to the end of `graph-designer-store.test.ts` (imports —
`createGraphDesignerStore`/`useGlobalStore` — are already present from
Task 14; no new imports needed):

```typescript
describe('createGraphDesignerStore — exclusive lock across two tabs on the same project', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('blocks a second tab on the same project while the first tab holds edit mode, then allows it once the first tab exits', () => {
    const tabA = createGraphDesignerStore('tab-a', 'proj-shared-1');
    const tabB = createGraphDesignerStore('tab-b', 'proj-shared-1');

    const firstTabAcquired = tabA.getState().enterEditMode();
    const secondTabAcquired = tabB.getState().enterEditMode();

    expect(firstTabAcquired).toBe(true);
    expect(secondTabAcquired).toBe(false);
    expect(tabA.getState().mode).toBe('edit');
    expect(tabB.getState().mode).toBe('view');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-shared-1'],
    ).toBe('usecase-edit');

    tabA.getState().exitEditMode();
    const secondTabAcquiredAfterExit = tabB.getState().enterEditMode();

    expect(secondTabAcquiredAfterExit).toBe(true);
    expect(tabB.getState().mode).toBe('edit');
    expect(tabA.getState().mode).toBe('view');
  });
});
```

(The contrast case — two tabs on *different* projects both succeeding — is
already covered by this same file's existing "scopes the exclusive lock to
the projectId passed at creation, not a flat flag" test from Task 14; it is
not repeated here.)

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-designer-store.test.ts"`
Expected: PASS, this new test green alongside Task 14's two existing tests
in the same file. Unlike the TDD "RED" step used elsewhere in this plan,
this test is not expected to fail first — `enterEditMode`/`exitEditMode`
(Tasks 10–11) and the exclusive-lock slice's same-mode-twice rejection
(Tasks 7–8) are already fully implemented by prior chapters; this task adds
no production code. If this test fails, it signals a real integration bug
between those two independently-tested pieces — e.g. `enterEditMode` not
actually reading the real `useGlobalStore` singleton — not a missing
implementation to write here.

- [ ] **Step 3: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/tests/features/graph-designer/graph-designer-store.test.ts
  git commit -m "test(react): cover exclusive lock across two tabs on the same project" \
             -m "Closes the one exclusive-lock scenario the foundation-plan" \
             -m "handoff called for that no prior chapter's own tests" \
             -m "exercised: two real createGraphDesignerStore instances" \
             -m "(two simulated Graph Designer tabs) scoped to the SAME" \
             -m "projectId, where only one can hold 'usecase-edit' at a" \
             -m "time and the second can acquire it only after the first" \
             -m "calls exitEditMode(). The different-projects contrast" \
             -m "case is already covered by this file's existing test." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 41: Integration test — full edit-session round-trip through a mixed three-entity-kind mutation response

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/tests/features/graph-designer/graph-designer-store.test.ts` (add cases to the existing file)

**Spec:** `docs/graph-designer-edit/plans/foundation-plan-handoff.md` Batch 4 —
"full mutation round-trip against a mocked three-collection backend
response, verifying `GraphDataSlice` state post-merge for pure-create,
pure-delete, and mixed cases."

**Why this is a genuine gap, not a duplicate.** Reading every
`applyComponentCollection`/`applyAddedCollection`/`applyDeletedCollection`
test across Tasks 24–26 and
Tasks 30–34:
- Tasks 24, 25, and 26 each test exactly one bucket kind in isolation
  (modules only, then links only, then subsystems only) via
  `applyAddedCollection`/`applyDeletedCollection` directly — never all three
  together in one call, and never through the top-level
  `applyComponentCollection` orchestrator.
- Task 26's fourth test ("resolves a link endpoint against a subsystem newly
  added in the same collection") is the closest existing case to a mixed
  call — it does combine a link and a subsystem in one
  `applyAddedCollection` call — but it still has no module in that same
  collection, tests `applyAddedCollection` alone (not
  `applyComponentCollection`, so `recomputeContainersAndSubgraphs`/
  `pruneDeletedLinkBookkeeping`/`adjustSurvivingPortCounts` never run), and
  has no delete side at all.
- Task 34's `applyComponentCollection` test (the only one that exists for
  the orchestrator itself) is a pure-create-plus-pure-delete case, but its
  `added`/`deleted`/`updated` collections carry **only links** —
  `spfModules`/`subsystems` are empty in every bucket. It proves the
  orchestrator's four-step sequencing (merge → recompute → prune → adjust
  ports) works for links, but never exercises a collection where modules,
  links, *and* subsystems are all present together in the same `added`/
  `deleted` buckets of one call.
- None of the six chapters' tests wrap a reconciliation call in
  `enterEditMode()`/`withMutationLock()`/`exitEditMode()` — each chapter
  tested its own slice in isolation (`EditSessionSlice`'s mode machine
  under Tasks 10–14; `GraphDataSlice`'s reconciler under Tasks 24–34), never
  the composed sequence a real Apply Changes call will actually run through
  end to end. (The Apply Changes flow itself — the network call that
  produces this response — is explicitly out of scope for this foundation
  plan per `foundation-plan-handoff.md`'s "Explicitly out of scope" list;
  this test uses a directly-constructed mocked response object in place of
  that not-yet-built network call, the same way Task 34's own test
  constructs its collections directly rather than mocking an HTTP call.)

This task adds the one true end-to-end test: `enterEditMode()` → a mocked
mutation response reconciled via `withMutationLock` +
`applyComponentCollection`, with `added`/`deleted` buckets that together
touch all three entity kinds (modules, links, subsystems) in a genuinely
mixed create-and-delete shape → `exitEditMode()` → assert the final
`GraphDataSlice` and `EditSessionSlice` state.

- [ ] **Step 1: Write the test**

Add to the end of `graph-designer-store.test.ts`. Add the new imports
alongside the file's existing ones:

```typescript
import {withMutationLock} from '~features/graph-designer/model/edit-session-slice';
import type {
  ControlLinkDto,
  DataLinkDto,
  SpfModuleDto,
  SubsystemDto,
} from '~entities/usecases/model/usecase-component.dto';
```

Add these fixture builders (mirroring the ones already established in
`graph-data-slice.test.ts` by Tasks 24–26, redeclared here since this is a different test file):

```typescript
function makeSpfModuleDto(overrides: Partial<SpfModuleDto> = {}): SpfModuleDto {
  return {
    alias: '',
    changeInfo: {changeType: 'CREATE'},
    containerId: 10,
    controlPorts: [],
    dataPorts: [],
    heapId: 0,
    id: 1,
    maxControlPortsSupported: 0,
    maxInputPortsSupported: 0,
    maxOutputPortsSupported: 0,
    moduleId: 200,
    name: 'Module',
    relatedEndPointLinks: [],
    subgraphId: 1,
    systemId: 'mod-placeholder',
    ...overrides,
  };
}

function makeDataLinkDto(overrides: Partial<DataLinkDto> = {}): DataLinkDto {
  return {
    changeInfo: {changeType: 'CREATE'},
    connectionType: 'MODULE_MODULE',
    destinationId: 2,
    destinationPortId: 20,
    isDangling: false,
    name: 'link',
    relatedEndPointLinks: [],
    sourceId: 1,
    sourcePortId: 10,
    systemId: 'link-placeholder',
    ...overrides,
  };
}

function makeSubsystemDto(overrides: Partial<SubsystemDto> = {}): SubsystemDto {
  return {
    changeInfo: {changeType: 'DELETE'},
    controlPorts: [],
    dataPorts: [],
    filteredKeys: [],
    id: 50,
    name: 'Subsystem',
    relatedEndPointLinks: [],
    systemId: 'ss-placeholder',
    ...overrides,
  };
}
```

Then add the test:

```typescript
describe('createGraphDesignerStore — full edit-session round-trip through a mixed mutation response', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('reconciles a mixed create/delete response spanning modules, links, and subsystems inside one edit session', async () => {
    const store = createGraphDesignerStore('tab-e2e', 'proj-e2e-1');
    store.setState({
      graphData: {
        connections: [
          {
            connectionId: 'link-old',
            connectionType: 'data',
            fromModuleId: 'mod-A',
            fromPortId: '11',
            toModuleId: 'ss-1',
            toPortId: '90',
          },
        ],
        containers: {},
        moduleInstances: {
          'mod-A': {
            containerId: 'c1',
            displayName: 'Mod A',
            id: 1,
            inputPorts: [],
            moduleId: '100',
            moduleInstanceId: 'mod-A',
            moduleName: 'Mod A',
            moduleType: 'SOURCE',
            outputPorts: [
              {
                direction: 'output',
                isStatic: false,
                portId: '11',
                portName: 'out1',
                portType: 'data',
                totalLinksAtPort: 1,
              },
              {
                direction: 'output',
                isStatic: false,
                portId: '12',
                portName: 'out2',
                portType: 'data',
                totalLinksAtPort: 0,
              },
            ],
            position: {x: 0, y: 0},
            subgraphId: 'sg-1',
          },
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {
          'ss-1': {
            controlPorts: [],
            dataPorts: [],
            id: 50,
            subgraphs: ['sg-1'],
            subsystemId: 'ss-1',
            subsystemName: 'Subsystem 1',
          },
        },
      },
      excludedLinks: [
        {
          connectionId: 'link-old',
          connectionType: 'data',
          fromModuleId: 'mod-A',
          fromPortId: '11',
          toModuleId: 'ss-1',
          toPortId: '90',
        },
      ],
      moduleList: [
        {
          builtIn: false,
          category: '',
          description: '',
          dspType: '',
          inputPorts: [],
          moduleId: '300',
          moduleName: 'Mod B',
          moduleType: 'SINK',
          outputPorts: [],
        },
      ],
      pairLinksById: new Map([
        [
          'link-old',
          {
            connectionType: 'data' as const,
            fromModuleId: 'mod-A',
            fromPortId: '11',
            id: 'link-old',
            sourceSubgraphId: 'sg-1',
            targetSubgraphId: 'sg-1',
            toModuleId: 'ss-1',
            toPortId: '90',
          },
        ],
      ]),
    });

    const entered = store.getState().enterEditMode();
    expect(entered).toBe(true);
    expect(store.getState().mode).toBe('edit');

    const empty = {controlLinks: [] as ControlLinkDto[], dataLinks: [] as DataLinkDto[], spfModules: [] as SpfModuleDto[]};

    await withMutationLock(store.getState, async () => {
      store.getState().applyComponentCollection({
        added: {
          ...empty,
          dataLinks: [
            makeDataLinkDto({
              destinationId: 2,
              destinationPortId: 21,
              sourceId: 1,
              sourcePortId: 12,
              systemId: 'link-new',
            }),
          ],
          spfModules: [
            makeSpfModuleDto({
              containerId: 20,
              dataPorts: [
                {
                  name: 'in1',
                  portIoType: 'Input',
                  portType: 'Dynamic',
                  systemId: '21',
                  totalLinksAtPort: 0,
                } as never,
              ],
              id: 2,
              moduleId: 300,
              name: 'Mod B',
              subgraphId: 2,
              systemId: 'mod-B',
            }),
          ],
        },
        deleted: {
          ...empty,
          dataLinks: [
            makeDataLinkDto({
              destinationId: 50,
              destinationPortId: 90,
              sourceId: 1,
              sourcePortId: 11,
              systemId: 'link-old',
            }),
          ],
          subsystems: [makeSubsystemDto({id: 50, systemId: 'ss-1'})],
        },
        updated: empty,
      });
    });

    expect(store.getState().isMutating).toBe(false);

    const state = store.getState();
    const graphData = state.graphData!;

    // Pure-create half: the new module and its link exist.
    expect(graphData.moduleInstances['mod-B']).toBeDefined();
    expect(graphData.moduleInstances['mod-B'].moduleType).toBe('SINK');
    expect(
      graphData.connections.find((c) => c.connectionId === 'link-new'),
    ).toEqual({
      connectionId: 'link-new',
      connectionType: 'data',
      fromModuleId: 'mod-A',
      fromPortId: '12',
      toModuleId: 'mod-B',
      toPortId: '21',
    });

    // Pure-delete half: the old link and the subsystem it terminated at are gone.
    expect(
      graphData.connections.find((c) => c.connectionId === 'link-old'),
    ).toBeUndefined();
    expect(graphData.subsystems['ss-1']).toBeUndefined();

    // recomputeContainersAndSubgraphs re-derived containers/subgraphs from
    // the surviving + newly-added modules together.
    expect(Object.keys(graphData.containers).sort()).toEqual(['20', 'c1']);
    expect(Object.keys(graphData.subgraphs).sort()).toEqual(['2', 'sg-1']);

    // pruneDeletedLinkBookkeeping dropped the deleted link's bookkeeping.
    expect(state.pairLinksById.has('link-old')).toBe(false);
    expect(state.excludedLinks).toEqual([]);

    // adjustSurvivingPortCounts moved both endpoints of the new link up and
    // the surviving endpoint of the deleted link down; the deleted link's
    // other endpoint (a subsystem, not a module) was silently skipped.
    const modA = graphData.moduleInstances['mod-A'];
    expect(modA.outputPorts.find((p) => p.portId === '11')?.totalLinksAtPort).toBe(0);
    expect(modA.outputPorts.find((p) => p.portId === '12')?.totalLinksAtPort).toBe(1);
    expect(
      graphData.moduleInstances['mod-B'].inputPorts[0].totalLinksAtPort,
    ).toBe(1);

    store.getState().exitEditMode();

    expect(store.getState().mode).toBe('view');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-e2e-1'],
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/graph-designer-store.test.ts"`
Expected: PASS, this new test green alongside every test already in this
file (Task 14's and Task 40's). As in Task 40, this is not a TDD "RED then
GREEN" test — every piece it composes
(`enterEditMode`/`withMutationLock`/`exitEditMode` from
Tasks 10–14; `applyComponentCollection` and its four
internal steps from Tasks 24–26/
Tasks 30–34) already exists and is already unit
tested in isolation. A failure here means the pieces don't compose
correctly together — e.g. a bucket-processing order bug, or a stale
`get()` read across one of `applyComponentCollection`'s five sequential
`set()` calls — which is exactly the class of bug per-chapter unit tests
structurally cannot catch.

- [ ] **Step 3: Run the full graph-designer test suite to confirm no regression**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/features/graph-designer/"`
Expected: PASS — every test across all six prior chapters plus this
chapter's two new tests, all green.

- [ ] **Step 4: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/tests/features/graph-designer/graph-designer-store.test.ts
  git commit -m "test(react): add full edit-session reconciliation round-trip test" \
             -m "The one integration gap no per-chapter unit test could" \
             -m "structurally cover: enterEditMode -> withMutationLock ->" \
             -m "applyComponentCollection, with added/deleted buckets that" \
             -m "together span all three entity kinds (a new module plus" \
             -m "its link, a deleted link plus the subsystem it terminated" \
             -m "at) in one call -> exitEditMode. Verifies the composed" \
             -m "GraphDataSlice/EditSessionSlice end state: module/link" \
             -m "merge, container/subgraph recompute, link-bookkeeping" \
             -m "pruning, and port-count adjustment all agree with each" \
             -m "other and with the released exclusive lock." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.

---

### Task 42: Release the exclusive lock on `beforeunload` (app quit/reload)

**Package:** `packages/react-app`

**Files:**
- Modify: `packages/react-app/src/widgets/editor-shell/ui/editor-shell.tsx`
- Test: `packages/react-app/tests/widgets/editor-shell/editor-shell.test.tsx` (add a case to the existing file if one exists, else create it)

**Spec:** `docs/graph-designer-edit/design/core-edit-session-design.md`'s
"Lock release is wired into every graceful close path" section — the one
release path the per-tab `useEffect` cleanup (Tasks 6–9's
`releaseExclusiveMode`, called from Tasks 10–14's `exitEditMode`) cannot
cover is an app quit/reload that tears down the renderer without running
React unmount cleanup at all. The design doc calls for a release call in
`editor-shell.tsx`'s existing `beforeunload` handler (already wired for
`ConfigFileManager.instance.save()` at
`packages/react-app/src/widgets/editor-shell/ui/editor-shell.tsx:242-265`,
confirmed by direct read of the current file), covering every project with
an active `'usecase-edit'` lock ahead of — or instead of — any per-tab
unmount cycle running.

This does not touch `'discovery-wizard'`/`'diff-merge'` locks — releasing
those on app teardown is those features' own concern, not this chapter's;
this task only releases the `'usecase-edit'` mode this plan introduces.

- [ ] **Step 1: Write the failing test**

```typescript
/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');
jest.mock('~shared/config/config-manager', () => ({
  ConfigFileManager: {
    instance: {save: jest.fn().mockResolvedValue(undefined)},
  },
}));

import {render} from '@testing-library/react';

import {useGlobalStore} from '~shared/store/global-store';
import EditorShell from '~widgets/editor-shell/ui/editor-shell';

describe('EditorShell — beforeunload exclusive-lock release', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('releases every usecase-edit lock on beforeunload', () => {
    useGlobalStore.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');
    useGlobalStore.getState().setActiveExclusiveMode('proj-2', 'usecase-edit');
    useGlobalStore
      .getState()
      .setActiveExclusiveMode('proj-3', 'discovery-wizard');

    render(<EditorShell />);
    window.dispatchEvent(new Event('beforeunload'));

    const locks = useGlobalStore.getState().activeExclusiveModeByProject;
    expect(locks['proj-1']).toBeUndefined();
    expect(locks['proj-2']).toBeUndefined();
    expect(locks['proj-3']).toBe('discovery-wizard');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/widgets/editor-shell/editor-shell.test.tsx"`
Expected: FAIL — `proj-1`/`proj-2` still hold `'usecase-edit'` after the
`beforeunload` event, since the handler doesn't release them yet.

- [ ] **Step 3: Add the release call to the existing `beforeunload` handler**

In `packages/react-app/src/widgets/editor-shell/ui/editor-shell.tsx`, add
the import:

```typescript
import {useGlobalStore} from '~shared/store/global-store';
```

Modify the existing `handleBeforeUnload` (lines 242-265) to release every
`'usecase-edit'` lock before saving config:

```typescript
  // Save configuration on app exit
  useEffect(() => {
    const handleBeforeUnload = () => {
      const {activeExclusiveModeByProject, releaseExclusiveMode} =
        useGlobalStore.getState();
      Object.entries(activeExclusiveModeByProject).forEach(
        ([projectId, mode]) => {
          if (mode === 'usecase-edit') {
            releaseExclusiveMode(projectId, mode);
          }
        },
      );

      // beforeunload is synchronous, so we can't reliably await async operations
      // Just trigger the save without waiting
      ConfigFileManager.instance.save().catch((error) => {
        logger.error('Failed to save configuration on exit', {
          action: 'save_config_on_exit',
          component: 'EditorShell',
          error: error instanceof Error ? error.message : String(error),
        });
      });
    };
```

This calls `releaseExclusiveMode` even in cases where a per-tab `useEffect`
cleanup would also have fired — safe and not a double-release in the
problematic sense, since `releaseExclusiveMode` (Tasks 6–9) is a no-op once
the lock for that `projectId`/`mode` pair is already gone.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/react-app && pnpm test -- --testPathPattern="tests/widgets/editor-shell/editor-shell.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Run the full test suite to confirm no regression**

Run: `cd packages/react-app && pnpm test`
Expected: PASS.

- [ ] **Step 6: Verify the project still typechecks**

Run: `cd packages/react-app && pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 7: Commit**

  Use the `commit` skill to draft the commit message. Show the proposed
  message and the exact commands to the user and **wait for explicit
  confirmation** before running anything:

  ```bash
  git add packages/react-app/src/widgets/editor-shell/ui/editor-shell.tsx \
          packages/react-app/tests/widgets/editor-shell/editor-shell.test.tsx
  git commit -m "fix(react): release usecase-edit lock on app quit/reload" \
             -m "The per-tab useEffect cleanup that normally releases the" \
             -m "cross-project exclusive lock never runs on an app" \
             -m "quit/reload, since that tears down the renderer without" \
             -m "React unmount cleanup. EditorShell's existing" \
             -m "beforeunload handler now also releases every" \
             -m "usecase-edit lock, closing the one gap" \
             -m "core-edit-session-design.md's Mode State section" \
             -m "identifies in the graceful-close release paths." \
             -m "Signed-off-by: [Name] <[email]>"
  ```

  **STOP — do not run `git commit` until the user explicitly approves the
  message.** Only execute after confirmation.
