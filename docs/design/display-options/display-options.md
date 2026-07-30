# Display Options

**Version:** 1.1

## Revision History

| Version | Date | Summary of changes |
| --- | --- | --- |
| 1.0 | 2026-07-27 | Initial merge of `display-options.md`, `port-visibility.md`, and the `expand-collapse-subgraphs` design into one doc. |
| 1.1 | 2026-07-30 | Expand Subgraphs checkbox now reads and writes `visualization.expandSubgraphs` directly via `savePreference`; `subgraph-collapse.ts` keeps only `allSubgraphIds` and `collapseSetForLevel`. Also adds a progress overlay — a blurred backdrop with a QUI `ProgressRing` and an "Expanding Subgraphs"/"Collapsing Subgraphs" label — shown while `graph-designer.tsx` applies a checkbox click. |

## Feature Overview and Strategic Fit

**Display Options in Side Nav:** The Graph Designer exposes a set of
visualization controls, accessible from a single **Display Options** entry
in the side nav (see Default Values below for the full control list).
Clicking it opens a QUI Popover panel containing Checkboxes and RadioGroup
controls for all visualization settings. Each change writes immediately to
the user preferences store, persisting the user's choices across sessions.
These controls are Graph Designer-specific and do not appear in the side nav
for any other tab.

Two of these controls — **Show all ports** and **Expand Subgraphs** — ship in
the popover from day one but start as no-op checkboxes: they write their
preference but nothing reads it yet. Wiring each one up to actually drive
rendering is documented in its own subsection below (see *Port Visibility*
and *Expand/Collapse All Subgraphs*), since each is a self-contained slice of
this same Display Options design rather than an independent feature.

### Port Visibility

The "Show all ports" checkbox is bound to `display.portVisibilityMode`
(`'all'` | `'active'`, default `'active'`), only visible in Detailed View.
Wiring it up filters module instance ports down to only _active_ ports by
default — see the *active port definition* in Requirements below for the
exact rule — decluttering graphs with many unused ports, with the option to
see all ports on demand. Implementation: see *Port Visibility Design* under
Component Design.

### Expand/Collapse All Subgraphs

The "Expand Subgraphs" checkbox is bound to `visualization.expandSubgraphs`.
Wiring it up turns it into a global control: one click expands or collapses
**all** subgraphs at the currently-viewed level, and the choice persists
across restarts. Today, subgraphs can only be collapsed/expanded one at a
time via each subgraph's own header button; this control adds a global one
alongside it, it does not replace the per-subgraph control. It reads and
writes the preference directly — clicking it always expands or collapses
everything at the current level, overriding any individual subgraph toggles
made there.

A collapsed subgraph renders as a single `SubgraphProxyNode` hiding its
internal containers and modules (see `apply-collapses.ts`). Because
collapsing removes a subgraph from `LevelView.subgraphs[]` (moving it to
`subgraphProxies[]` instead), the complete list of a level's subgraph ids
only ever lives on the **raw** `levelView`, never on the post-`applyCollapses`
graph — a distinction this design calls back to by name wherever it matters.
Implementation: see *Expand/Collapse Design* under Component Design.

---

## Architectural Impacts

- `side-nav-types.ts` adds `import type {ReactNode} from 'react'` and adds an
  optional `popoverContent?: ReactNode` field to the `SideNavItem` interface
  to support items that open a QUI Popover instead of navigating
- `arc-side-nav.tsx` adds a check in the leaf node renderer — if an item has
  `popoverContent`, it renders as a QUI Popover trigger instead of a standard
  nav link
- `user-preferences-types.ts` adds `showMdfModules` and `viewMode` to
  `VisualizationPreferences`, and adds `workflowType` and `workflowLevel` to
  `UsecasePreferences`. `DEFAULT_VISUALIZATION_PREFERENCES.expandSubgraphs`
  is `false`, so fresh users get an all-collapsed first-load view.
- `shared/config/hooks/use-user-preferences.ts` — no changes; still the
  single source of truth for reading/writing preferences.
- `display-options-popover.tsx` — new component containing checkboxes and
  RadioGroup controls for all visualization preferences. Does not call
  `useUserPreferences` itself; takes `preferences`, `projectId`, and
  `updatePreference` as props from its parent (see *Component Design*
  below).
- `graph-designer.tsx` connects to the user preferences system and registers
  the Display Options item in the side nav using the `SlidersHorizontal`
  icon. Becomes the sole owner of `useUserPreferences()`.
  Computes `effectivePortVisibilityMode` and applies `applyPortVisibility`
  inside Effect B, before `layoutLevelView`. Applies
  `preferences.visualization.expandSubgraphs` to the current level's
  collapse state whenever the level or the preference changes (see
  *Expand/Collapse Design* below).
- `widgets/graph-designer/lib/subgraph-collapse.ts` — new file holding the
  two pure functions this feature needs: `allSubgraphIds` and
  `collapseSetForLevel`. See *Expand/Collapse Design* below.
- `widgets/graph-designer/lib/apply-port-visibility.ts` — new file. Pure
  function `applyPortVisibility(level, effectiveMode)` that filters each
  module's `ports` array.

---

## Assumptions

- The user preferences system already exists and can be called to read and
  save preferences
- Preferences are saved using a dot-notation path format (e.g.
  `visualization.showControlLinks`)
- Display Options is only shown in the Graph Designer tab
- Preferences are saved to a config file on disk and persist between
  sessions
- The QUI Popover closes automatically when the user clicks outside it
- The checkboxes and RadioGroup controls reflect the current saved
  preferences and update them directly
- Both `Usecase Workflow` and `System Workflow` radios are always visible.
  `Subsystem level` / `Usecase level` render as a nested sub-choice under
  `Usecase Workflow` and collapse away when `System Workflow` is selected

---

## Default Values

All preferences fall back to these values when nothing has been saved yet
for the active project (`shared/config/user-preferences-types.ts`). If
preferences have not loaded yet on first render, every control falls back to
its value here (see Error Handling below).

| Preference (dot-notation path) | Default | Control |
| --- | --- | --- |
| `visualization.highlightPPModules` | `false` | Highlight PP Modules checkbox |
| `visualization.showControlLinks` | `true` | Show Control Links checkbox |
| `visualization.showDanglingLinks` | `true` | Show Dangling Links checkbox |
| `usecases.workflowType` | `'usecase-workflow'` | Workflow radio (Usecase Workflow / System Workflow) |
| `usecases.workflowLevel` | `'usecase-level'` | Nested Subsystem level / Usecase level radio |
| `display.portVisibilityMode` | `'active'` | Show all ports checkbox |
| `visualization.viewMode` | `'compact'` | Compact View / Detailed View radio |
| `visualization.showSubgraphIds` | `false` | Show Subgraph IDs checkbox |
| `visualization.showContainerIds` | `false` | Show Container IDs checkbox |
| `visualization.showModuleInstanceIds` | `false` | Show Module Instance IDs checkbox |
| `visualization.expandSubgraphs` | `false` | Expand Subgraphs checkbox |
| `visualization.simplifySubsystems` | `false` | Simplified Subsystems checkbox |
| `visualization.showMdfModules` | `false` | Show MDF Modules checkbox |
| `usecases.namePreference` | `'alias'` | Usecase Name radio (Alias / Key Value(s) / Value(s)) |

---

## Requirements

| Title | Requirement | Importance | Type |
| --- | --- | --- | --- |
| Display Options entry | As a user, I want a single Display Options entry in the side nav | Must Have | Functional |
| Popover opens on click | As a user, I want to click Display Options to open a Popover | Must Have | Functional |
| Show Control Links checkbox | As a user, I want to check or uncheck Show Control Links from the Popover | Must Have | Functional |
| Show Dangling Links checkbox | As a user, I want to check or uncheck Show Dangling Links from the Popover | Must Have | Functional |
| Highlight PP Modules checkbox | As a user, I want to check or uncheck Highlight PP Modules from the Popover | Must Have | Functional |
| Port Visibility — active port definition | A module port is active if its id appears as `sourcePortId`/`targetPortId` in `dataLinks`, `controlLinks`, `proxyDataLinks`, or `proxyControlLinks`. Applies to input, output, and control ports. `SubsystemNode`/`SubgraphProxyNode` ports have no active/non-active distinction — all are treated as active. | Must Have | Functional |
| Port Visibility — reuse existing control | The existing "Show all ports" checkbox and `display.portVisibilityMode` preference drive this feature. No new control or preference. Only visible under Detailed View. | Must Have | Functional |
| Port Visibility — effective visibility rule | Effective mode = `viewMode === 'detailed' ? portVisibilityMode : 'active'`. Compact View always forces active-only; Detailed View honors the saved preference. | Must Have | Functional |
| Port Visibility — resize and live update on toggle | Toggling re-filters the `LevelView` and re-runs ELK layout immediately (filter before layout, not after) — module, container, and subgraph boxes resize/repack to the true visible-port count, with no usecase reselect or reload needed. | Must Have | Functional |
| Expand Subgraphs — wire the control | The existing checkbox drives rendering, scoped to the currently-viewed `levelId`: checking expands all subgraphs at that level (collapse set → empty); unchecking collapses all to proxy nodes (collapse set → all subgraph ids at that level, from the **raw** `levelView`). No new control or preference key. | Must Have | Functional |
| Expand Subgraphs — individual toggles overridden | Per-subgraph header buttons still work, but any change to the `expandSubgraphs` preference re-applies to every subgraph at the current level, overriding whatever those buttons had set there. | Must Have | Functional |
| Expand Subgraphs — progress overlay | As a user, when I click Expand Subgraphs and the recompute takes a visible moment, I want a blurred overlay with a progress ring and an "Expanding Subgraphs"/"Collapsing Subgraphs" label over the graph canvas, so the screen doesn't look frozen. | Must Have | Functional |
| Simplified Subsystems checkbox | As a user, I want to check or uncheck Simplified Subsystems from the Popover. It is disabled only for the default combination — Usecase Workflow + Usecase level. It is enabled for Usecase Workflow + Subsystem level, and for System Workflow at either level. Enabling or disabling it never changes its checked value — it always shows whatever the user last checked or unchecked it to. | Must Have | Functional |
| Show MDF Modules checkbox | As a user, I want to check or uncheck Show MDF Modules from the Popover | Must Have | Functional |
| Compact View / Detailed View radio | As a user, I want to switch between Compact View and Detailed View from the Popover. **Compact View:** Nodes show names only — module/container/subgraph IDs are hidden for a smaller, denser, easier-to-read graph. **Detailed View:** Nodes show their full IDs (module instance, container, subgraph) alongside names, giving a complete view of each module. | Must Have | Functional |
| Workflow radio | As a user, I want to switch between Usecase Workflow and System Workflow from the Popover | Must Have | Functional |
| Usecase Name Preference radio | As a user, I want to switch between Alias, Key Value(s), and Value(s) name display from the Popover | Must Have | Functional |
| Preference persistence | As a user, I want my display choices to persist after I change them. Each change writes to the in-memory preferences store immediately, then a debounced (300ms) write flushes the full config to disk via `ConfigFileManager.save`; if the Popover closes before the debounce fires, the pending write flushes immediately on unmount instead of being dropped. | Must Have | Functional |
| Close on outside click | As a user, I want the Popover to close when I click outside it | Must Have | Functional |
| Graph Designer scope | As a user, I only want Display Options visible when I am in the Graph Designer tab | Must Have | Functional |

### Out of Scope

- `portStatus` (`'unused'|'partial'|'used'`) styling semantics — unchanged.
- Filtering `SubsystemNode` or `SubgraphProxyNode` ports — see the
  active-port definition above; there is nothing for the toggle to hide.

---

## User Interaction and Design

- A single **Display Options** entry appears in the side nav only when the
  Graph Designer tab is active
- Side nav collapsed: shows `SlidersHorizontal` icon only with a tooltip
  reading "Display Options"
- Side nav expanded: shows `SlidersHorizontal` icon and "Display Options"
  label
- Clicking Display Options opens a QUI Popover to the right of the side nav
- The Popover has four sections: Graph View, Workflow, Graph Display, and
  Usecase Name
- Checkboxes show the current on/off state; "Show all ports" only appears
  once Detailed View is selected. "Expand Subgraphs" reflects
  `visualization.expandSubgraphs` directly.
- RadioGroup controls show the current selection
- Every change writes immediately to the user preferences store (see
  Preference persistence above for the exact save mechanism)
- Clicking anywhere outside the Popover closes it — any pending debounced
  write is flushed on close, so no change made just before closing is lost
- While `graph-designer.tsx` applies a checkbox-triggered Expand Subgraphs
  change, a blurred overlay with a QUI `ProgressRing` and an "Expanding
  Subgraphs"/"Collapsing Subgraphs" label covers the graph canvas (see
  *Expand/Collapse Design* below)

**Popover UI (default state — Usecase Workflow / Usecase level / Compact
View):**
```
┌───────────────────────────────────────┐
│ GRAPH VIEW                             │
│ ☐ Highlight PP Modules                 │
│ ☑ Show Control Links                   │
│ ☑ Show Dangling Links                  │
├───────────────────────────────────────┤
│ WORKFLOW                               │
│ ● Usecase Workflow                     │
│     ○ Subsystem level                  │
│     ● Usecase level                    │
│ ○ System Workflow                      │
├───────────────────────────────────────┤
│ GRAPH DISPLAY                          │
│ ● Compact View                         │
│ ○ Detailed View                        │
│ ☐ Expand Subgraphs                     │
│ ☐ Simplified Subsystems (disabled)     │
│ ☐ Show MDF Modules                     │
├───────────────────────────────────────┤
│ USECASE NAME                           │
│ ● Alias                                │
│ ○ Key Value(s)                         │
│ ○ Value(s)                             │
└───────────────────────────────────────┘
```
(Expand Subgraphs shows unchecked by default — `expandSubgraphs` defaults to
`false`, so a fresh project's first load has every subgraph collapsed.)

Selecting Subsystem level (still Usecase Workflow) enables Simplified
Subsystems with no other visible change. Selecting System Workflow hides the
nested level radios and also enables Simplified Subsystems — its checked
value is never forced either way in any of these transitions (see the
Simplified Subsystems row in Requirements above). Selecting Detailed View
reveals four more checkboxes — Show Subgraph IDs, Show Container IDs, Show
Module Instance IDs, Show all ports — nested beneath it.

---

## Component Design

**New file:** `display-options-popover.tsx`
A QUI Popover that opens to the right of the side nav when the user clicks
Display Options. Organized into four sections:

**Props.** `DisplayOptionsPopover` does not call `useUserPreferences`
itself — its parent, `graph-designer.tsx`, is the sole owner of that hook
and passes the result down as props:

```ts
interface DisplayOptionsPopoverProps {
  preferences: UserPreferences;
  projectId: string;
  updatePreference: (path: string, value: unknown) => boolean;
}
```

`projectId` is kept as its own prop because the popover's internal
`flushSave` calls `ConfigFileManager.instance.save(projectId)` directly.
Only the `preferences` read and `updatePreference` write are lifted to the
parent. Because `graph-designer.tsx` calls `useUserPreferences()`
once and passes the same `preferences` object to both `DisplayOptionsPopover`
and its own render pipeline, a checkbox toggle re-renders both consumers with
the new value in the same pass — no context or event-emitter is needed,
since the two already share a parent.

**Graph View** — three Checkboxes:
- Highlight PP Modules
- Show Control Links
- Show Dangling Links

**Workflow** — a single `RadioGroup` with `Usecase Workflow` / `System Workflow`:
- When `Usecase Workflow` is selected, a nested `RadioGroup` (`Subsystem
  level` / `Usecase level`) renders indented directly beneath it
- When `System Workflow` is selected, the nested `RadioGroup` is not
  rendered

**Graph Display**:
- Compact View / Detailed View — RadioGroup with two options
- When Detailed View is selected: Show Subgraph IDs, Show Container IDs,
  Show Module Instance IDs, and Show all ports — four additional
  Checkboxes, indented under the Detailed View option. Show all ports maps
  to `display.portVisibilityMode` (`'all'` when checked, `'active'` when
  unchecked); see *Port Visibility Design* below for how the effective mode
  is computed and applied.
- **Expand Subgraphs** — Checkbox, always visible. `checked` reads
  `visualization.expandSubgraphs` directly; `onCheckedChange` calls
  `savePreference('visualization.expandSubgraphs', checked)` — the same
  pattern as every other checkbox in this popover. See *Expand/Collapse
  Design* below for how `graph-designer.tsx` applies the change.
- Simplified Subsystems — Checkbox. `disabled` follows the Workflow
  type/level rule in Requirements above; checked value is preserved across
  all transitions (same row). While disabled, a QUI Tooltip wraps the
  checkbox explaining why ("Select Subsystem level or System Workflow to
  enable")
- Show MDF Modules — Checkbox

**Usecase Name** — RadioGroup with three options:
- Alias
- Key Value(s)
- Value(s)

Each control reads the current saved preference and writes back immediately
when the user makes a change.

### Port Visibility Design

**`applyPortVisibility` transform:**

```ts
export function applyPortVisibility(
  level: LevelView,
  effectiveMode: 'all' | 'active',
): LevelView;
```

- `effectiveMode === 'all'` → returns `level` unchanged (reference
  equality), matching the no-op short-circuit pattern already used in
  `applyPositionOverrides`.
- `effectiveMode === 'active'` → builds a `Set<string>` of active port ids
  from `level.dataLinks`, `level.controlLinks`, `level.proxyDataLinks`, and
  `level.proxyControlLinks` (`sourcePortId` and `targetPortId` from each),
  then maps `level.modules`, filtering each module's `ports` to only ids in
  that set. Proxy links must count: `applyCollapses` removes a
  boundary-crossing `dataLink`/`controlLink` and replaces it with a proxy
  link once the subgraph on the other end is collapsed, so a port whose only
  connection now lives in a proxy link is still genuinely connected.
- Runs on the **unpositioned** `LevelView`, before `layoutLevelView`/ELK, so
  `calculateModuleHeight` sizes each module from its true visible port
  count — toggling the checkbox therefore genuinely resizes and repacks
  boxes, not a cosmetic post-layout filter (see *Pipeline wiring* below for
  exactly where this runs). At this point in the pipeline no subgraph has
  been collapsed yet, so `proxyDataLinks`/`proxyControlLinks` are always
  empty — the proxy-link scan is defensive for any future or alternate call
  site that runs after collapse.
- No anchor-math changes needed: `getPortAnchors` (via `offsetForIndex`)
  already derives handle positions purely from the length and order of the
  `ports` array it's given, so a filtered array is automatically packed with
  no gaps.

Effective mode is computed once in `GraphDesigner`:

```ts
const effectivePortVisibilityMode =
  preferences.visualization.viewMode === 'detailed'
    ? preferences.display.portVisibilityMode
    : 'active';
```

**Pipeline wiring:** `graph-designer.tsx`'s Effect B (builds `LevelView`
from `graphData`) gains a filter step before layout, and re-runs when the
mode changes:

```ts
useEffect(() => {
  if (graphDataStatus !== 'ready' || !graphData) return;
  const levelId = selectedUsecases.join(',');
  const unpositioned = buildLevelViewFromGraphData(graphData, levelId);
  const filtered = applyPortVisibility(unpositioned, effectivePortVisibilityMode);
  void layoutLevelView(filtered).then((lv) => setLevelView(lv));
}, [
  graphDataStatus,
  graphData,
  selectedUsecases,
  setLevelView,
  effectivePortVisibilityMode,
]);
```

The effect previously ran once per usecase selection (guarded by `levelView
!== null`); that guard is dropped and `effectivePortVisibilityMode` is added
as a dependency so a checkbox toggle re-triggers the full layout — a real
async ELK pass, not an instant in-memory filter.

The `graph` `useMemo` (collapse + position-override pipeline) no longer
calls `applyPortVisibility` — `levelView` is already filtered by the time it
reaches that memo, so a second filter pass there would be redundant.

### Expand/Collapse Design

**One module** (`widgets/graph-designer/lib/subgraph-collapse.ts`) holds
every pure function this feature needs:

```ts
// Reads the raw levelView (see Feature Overview above), never the
// post-applyCollapses graph.
export function allSubgraphIds(level: LevelView): number[];

// The collapse set a level should have for a given expandSubgraphs value:
// empty when expanded, every subgraph id when collapsed.
export function collapseSetForLevel(
  level: LevelView,
  expandSubgraphs: boolean,
): Set<number>;
```

**`GraphDesigner`** (already owns `collapseByLevel`, `levelId`,
`preferences`) adds:

- `appliedExpandSubgraphsRef` — the last `expandSubgraphs` value the effect
  below applied, used to tell a checkbox click apart from any other reason
  the effect re-ran (a new usecase selection, the Show all ports toggle,
  etc.) — both change `levelView` or `preferences`, but only a checkbox
  click should show the overlay.
- A `useEffect`, keyed on `levelView` and
  `preferences.visualization.expandSubgraphs`, that always rewrites
  `collapseByLevel[levelView.levelId]` via `collapseSetForLevel`. When the
  ref shows the preference itself changed, the rewrite runs inside
  `startExpandCollapseTransition` (from `useTransition`) so `isPending`
  drives the overlay below; otherwise it runs directly, with no overlay.

**Progress overlay:** a large usecase selection can make the
`collapseSetForLevel` write and the resulting re-render of the graph take a
visible moment. While `isPending` is `true`, `GraphDesigner` renders (via
`createPortal` into `document.body`, so it isn't clipped by the canvas's
`overflow-hidden` container) a `fixed inset-0` backdrop with `backdrop-blur-sm`,
a QUI `ProgressRing`, and a label reading "Expanding Subgraphs" or
"Collapsing Subgraphs" depending on `preferences.visualization.expandSubgraphs`.
Colors come from QUI design tokens only (`--color-surface-overlay`,
`--color-surface-raised`, `--color-text-neutral-primary`).

---

## Database Design

Not applicable on frontend.

---

## Error Handling

- If a preference fails to save — either the in-memory `updatePreference`
  write fails, or the debounced on-disk `ConfigFileManager.save` resolves
  `false` or rejects — a toast notification is shown to the user
- If preferences have not loaded yet on first render, all controls fall back
  to the values in the Default Values table above
- `applyPortVisibility` and `collapseSetForLevel` are pure, total functions
  over already-validated `LevelView` / in-memory state — no new failure
  modes. A module with zero active ports renders with an empty `ports`
  array, a valid existing state no different from a module that has no
  ports of a given `portIoType` today.

---

## Security Considerations

- No network calls are made — all preferences are stored locally in a
  config file on disk
- No free-text input from the user — all values come from fixed checkboxes
  and RadioGroup selections
- `expandSubgraphs` and `display.portVisibilityMode` already exist in the
  preferences schema; wiring them up changes no persisted shape, only which
  code reads them

---

## Performance Considerations

- The side nav item list is only rebuilt when the user's preferences change
- The QUI Popover content is not loaded until the user opens it for the
  first time — no cost while it is closed
- Each preference change causes one re-render of the Popover only — no
  unnecessary updates
- Disk writes are debounced (300ms) so rapid successive toggles collapse
  into a single `ConfigFileManager.save` call rather than one per click
- `applyPortVisibility` itself is O(links + ports), negligible on its own.
  The real cost is that it now runs before `layoutLevelView`, so toggling
  "Show all ports" re-triggers the full async ELK layout pass (per-subgraph
  ELK calls, subgraph-column assignment, bounding-box computation) instead
  of an instant synchronous filter — correct box sizing requires ELK to see
  the true port count, which only happens by re-running layout.
- `allSubgraphIds` and `collapseSetForLevel` are O(n) over a level's
  subgraphs, negligible next to the `applyCollapses` / layout pipeline that
  already runs per render.

---

## Testing Strategy

**Unit Tests:**

- Popover renders all three Graph View checkboxes, all Graph Display
  controls, and all Radio options across the Workflow RadioGroup (and its
  nested sub-group), Compact/Detailed View, and the Usecase Name RadioGroup
- Each checkbox/Radio calls `savePreference` with the correct preference
  path and new value on interaction, including Expand Subgraphs
- Both `Usecase Workflow` and `System Workflow` radios are always present
- `Subsystem level` / `Usecase level` are visible when `Usecase Workflow` is
  selected, hidden when `System Workflow` is selected, and reappear when
  switching back
- Detailed-View-only checkboxes are hidden in Compact View and appear after
  switching to Detailed View
- Simplified Subsystems is disabled for the default Usecase Workflow +
  Usecase level combination
- Simplified Subsystems is enabled after selecting Subsystem level under
  Usecase Workflow
- Simplified Subsystems is enabled after selecting System Workflow
- Simplified Subsystems' checked value is never altered by any Workflow
  type/level transition — enabling, disabling, and re-enabling all preserve
  the last value the user set
- A Tooltip explaining why Simplified Subsystems is disabled appears only
  while it is disabled
- Show all ports is hidden outside Detailed View and saves
  `display.portVisibilityMode` as `'all'`/`'active'` when checked/unchecked
- Expand Subgraphs reflects `visualization.expandSubgraphs` directly and
  saves the new value via `savePreference` when clicked — same pattern as
  every other checkbox
- A toast notification is shown when a preference save fails
- A pending debounced save flushes immediately when the Popover unmounts
  (verifies no change is lost on close)
- `applyPortVisibility`: `'all'` mode returns the input unchanged (reference
  equality); `'active'` mode filters ports per the active-port rule above
  (a port referenced only via a proxy link still counts as active); a
  module with no connections yields an empty `ports` array; `height`/
  `width`/other fields are left untouched
- Effective port-visibility mode: `viewMode: 'compact'` forces `'active'`
  regardless of `portVisibilityMode`; `viewMode: 'detailed'` passes
  `portVisibilityMode` through unchanged
- `allSubgraphIds`: returns every id from `level.subgraphs`; returns `[]`
  for empty/absent `subgraphs`
- `collapseSetForLevel`: returns an empty set when `expandSubgraphs` is
  `true`; returns every subgraph id when `false`

**Integration Tests:**

- Click Display Options → QUI Popover opens
- Check/uncheck Show Control Links, Show MDF Modules → correct preference
  save triggered
- Select Detailed View → correct preference save triggered, ID checkboxes
  and Show all ports appear
- Select System Workflow → correct preference save triggered,
  Subsystem/Usecase level radios disappear, Simplified Subsystems becomes
  enabled (checked value unchanged)
- Select Subsystem level / Usecase level (while Usecase Workflow is active)
  → correct preference save triggered; Simplified Subsystems enables on
  Subsystem level, disables on Usecase level, checked value unchanged
  either way
- Select Alias / Key Value(s) / Value(s) → correct preference save
  triggered
- Simulate preference save failure → toast notification appears
- Click outside Popover → Popover closes
- Switch to a non-Graph Designer tab → Display Options is not visible
- Switch back to Graph Designer → Display Options reappears

**End-to-End equivalent:**

- Uncheck Show Dangling Links / Show MDF Modules → close Popover → simulate
  reload → verify preference still off
- Select Detailed View → close → reopen → verify still selected
- Select System Workflow → close → reopen → verify still selected and the
  nested level radios stay hidden
- Verify only one Radio option can be active per group at a time

**Manual verification — `graph-designer.tsx`:**

`graph-designer.tsx` has no existing test harness (rendering it requires
mocking `GraphDesignerStoreContext`, async ELK layout, `SideNavProvider`,
and the full `UsecaseVisualizer`/`@xyflow/react` tree — infrastructure no
other test in this suite builds). Every pure function in
`subgraph-collapse.ts` and the `effectivePortVisibilityMode` formula are
already covered by unit tests above; the wiring itself is verified manually
in the running app:

- Toggling "Show all ports" re-runs layout and updates module box sizes and
  port handles, without reselecting the usecase or reloading the graph data
- Compact View shows only active ports regardless of the saved
  `portVisibilityMode` value
- Detailed View with `portVisibilityMode: 'all'` shows all ports and larger
  module boxes; with `'active'` shows only connected ports and
  correspondingly smaller, tightly-packed boxes
- A fresh load is all-collapsed (default is `false`); checking Expand
  Subgraphs expands all subgraphs at the current level, unchecking
  re-collapses them
- Collapsing one subgraph individually via its own header button does not
  touch the Expand Subgraphs checkbox or the persisted preference
- The Expand Subgraphs choice survives an app restart
- Clicking Expand Subgraphs shows the blur overlay with a spinning
  `ProgressRing` and the correct "Expanding"/"Collapsing Subgraphs" label
  until the recompute finishes

---

## Open-Source Libraries

- `ConfigFileManager` — reads and writes user preferences to the user
  preferences store
- React — manages Popover state and re-renders when preferences change
- `lucide-react` — provides the `SlidersHorizontal` icon for the Display
  Options side nav entry
- QUI Popover — the Popover triggered by clicking Display Options
- QUI Checkbox — the checkbox controls for boolean preference values in
  Graph View and Graph Display
- QUI Radio — the RadioGroup controls for Workflow (and its nested level
  sub-group), Compact/Detailed View, and Usecase Name preference selections
- QUI Tooltip — explains why Simplified Subsystems is disabled
- QUI Toast Notification — displays a notification when a preference fails
  to save
