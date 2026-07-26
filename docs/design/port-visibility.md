## Feature Overview and Strategic Fit

The Graph Designer's Display Options popover already has a "Show all ports"
checkbox, bound to `display.portVisibilityMode` (`'all'` | `'active'`,
default `'active'`), only visible in Detailed View. Today it saves to user
preferences but is never read anywhere — module nodes always render every
port regardless of the preference. This feature wires that existing control up:
module instance ports are filtered to only _active_ (connected) ports by
default, decluttering graphs with many unused ports, with the option to see
all ports on demand.

---

## What Is an Active Port

A port on a `ModuleNode` is **active** if its `id` appears as `sourcePortId`
or `targetPortId` on any entry in the current `LevelView`'s `dataLinks`,
`controlLinks`, `proxyDataLinks`, or `proxyControlLinks`. This applies
uniformly to input, output, and control ports. All other ports are
**non-active**.

`SubsystemNode` and `SubgraphProxyNode` ports have no active/non-active
distinction — every one of their ports is treated as active, so toggling
"Show all ports" has no visible effect on them. `applyPortVisibility` only
filters `ModuleNode.ports`.

---

## Requirements

| Title                       | Requirement                                                                                                                                                    | Importance | Type       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| Active port definition      | A module port is active if its id appears as `sourcePortId`/`targetPortId` in `dataLinks`, `controlLinks`, `proxyDataLinks`, or `proxyControlLinks`. Applies to input, output, and control ports. | Must Have  | Functional |
| Reuse existing control      | The existing "Show all ports" checkbox and `display.portVisibilityMode` preference drive this feature. No new control or preference.                           | Must Have  | Functional |
| Effective visibility rule   | Effective mode = `viewMode === 'detailed' ? portVisibilityMode : 'active'`. Compact View always forces active-only; Detailed View honors the saved preference. | Must Have  | Functional |
| Resize on toggle             | Toggling the checkbox re-runs ELK layout so module, container, and subgraph boxes resize/repack to fit only the visible ports. Filtering runs before layout, not after. | Must Have  | Functional |
| Live update                 | Toggling the checkbox updates the rendered graph immediately, without reselecting the usecase or reloading.                                                    | Must Have  | Functional |

### Out of Scope

- `portStatus` (`'unused'|'partial'|'used'`) styling semantics — unchanged.
- Filtering `SubsystemNode` or `SubgraphProxyNode` ports. These node types
  have no active/non-active distinction; all of their ports are active by
  definition, so there is nothing for the toggle to hide.

---

## Architectural Impacts

- `shared/config/hooks/use-user-preferences.ts` — no changes; still the
  single source of truth for reading/writing preferences.
- `widgets/graph-designer/ui/display-options-popover.tsx` — stops calling
  `useUserPreferences` itself. Takes `preferences`, `projectId`, and
  `updatePreference` as props instead of `projectId` alone. Internal
  debounced-save logic (`flushSave`, `SAVE_DEBOUNCE_MS`) is unchanged.
- `widgets/graph-designer/ui/graph-designer.tsx` — becomes the sole owner of
  `useUserPreferences(projectGroupId)`. Passes `preferences` and
  `updatePreference` down to `DisplayOptionsPopover`. Computes
  `effectivePortVisibilityMode` and applies `applyPortVisibility` inside
  Effect B, before `layoutLevelView`, so the mode is part of the layout
  input rather than a post-layout render step.
- `widgets/graph-designer/lib/apply-port-visibility.ts` — new file. Pure
  function `applyPortVisibility(level, effectiveMode)` that filters each
  module's `ports` array.

---

## Design

### 1. Preference lifting

This feature requires `effectivePortVisibilityMode` to be computed from live
preferences at the same level `<DisplayOptionsPopover>` renders, so
`DisplayOptionsPopover`'s props change to take `preferences` and
`updatePreference` from its parent instead of calling `useUserPreferences`
itself. That props interface and its rationale are documented in
[display-options.md](./display-options.md)'s Component Design section.

### 2. `applyPortVisibility` transform

```ts
export function applyPortVisibility(
  level: LevelView,
  effectiveMode: 'all' | 'active',
): LevelView;
```

- `effectiveMode === 'all'` → returns `level` unchanged (reference equality),
  matching the no-op short-circuit pattern already used in
  `applyPositionOverrides`.
- `effectiveMode === 'active'` → builds a `Set<string>` of active port ids
  from `level.dataLinks`, `level.controlLinks`, `level.proxyDataLinks`, and
  `level.proxyControlLinks` (`sourcePortId` and `targetPortId` from each),
  then maps `level.modules`, filtering each module's `ports` to only ids in
  that set. Proxy links must count: `applyCollapses` removes a
  boundary-crossing `dataLink`/`controlLink` and replaces it with a proxy
  link once the subgraph on the other end is collapsed, so a port whose only
  connection now lives in a proxy link is still genuinely connected.
- Runs on the **unpositioned** `LevelView`, before `layoutLevelView`/ELK,
  so `calculateModuleHeight` sizes each module from its true visible port
  count. Toggling the checkbox therefore genuinely resizes and repacks
  boxes — it is not a cosmetic post-layout filter. At this point in the
  pipeline no subgraph has been collapsed yet, so `proxyDataLinks`/
  `proxyControlLinks` are always empty — the proxy-link scan is defensive
  for any future or alternate call site that runs after collapse.
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

### 3. Pipeline wiring

`graph-designer.tsx`'s Effect B (builds `LevelView` from `graphData`) gains a
filter step before layout, and re-runs when the mode changes:

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

Filtering happens on `unpositioned`, before `layoutLevelView`/ELK, so module
height, container boxes, and subgraph boxes are all sized and packed from
the true visible port count in one pass — no post-hoc resize step needed.
The effect previously ran once per usecase selection (guarded by
`levelView !== null`); that guard is dropped and `effectivePortVisibilityMode`
is added as a dependency so a checkbox toggle re-triggers the full layout.
A toggle therefore runs a real async ELK pass instead of an instant
in-memory filter.

The `graph` `useMemo` (collapse + position-override pipeline) no longer
calls `applyPortVisibility` — `levelView` is already filtered by the time it
reaches that memo, so a second filter pass there would be redundant.

---

## Error Handling

No new failure modes. `applyPortVisibility` is a pure, total function over
already-validated `LevelView` data. A module with zero active ports renders
with an empty `ports` array — a valid existing state, no different from a
module that has no ports of a given `portIoType` today. Preference save
failures continue to surface via the existing toast in
`DisplayOptionsPopover`, unchanged.

---

## Testing Strategy

**Unit — `applyPortVisibility`:**

- `'all'` mode returns the input `LevelView` unchanged (reference equality).
- `'active'` mode filters out ports absent from `dataLinks`, `controlLinks`,
  `proxyDataLinks`, and `proxyControlLinks`.
- A port referenced only via a proxy link still counts as active.
- A port referenced only as `sourcePortId`, or only as `targetPortId`, both
  count as active.
- A module with no connections yields an empty `ports` array.
- Module `height`, `width`, and other fields are left untouched by the
  transform — only `ports` is filtered.

**Unit — effective mode computation:**

- `viewMode: 'compact'` forces `'active'` regardless of `portVisibilityMode`.
- `viewMode: 'detailed'` passes `portVisibilityMode` through unchanged.

**Manual verification — `graph-designer.tsx`:**
`graph-designer.tsx` has no existing test harness (rendering it requires
mocking `GraphDesignerStoreContext`, async ELK layout, `SideNavProvider`, and
the full `UsecaseVisualizer`/`@xyflow/react` tree — infrastructure no other
test in this suite builds). The `effectivePortVisibilityMode` formula and the
`applyPortVisibility` transform are already covered by the unit tests above;
the wiring itself is verified manually in the running app:

- Toggling "Show all ports" re-runs layout and updates module box sizes and
  port handles, without reselecting the usecase or reloading the graph data.
- Compact View shows only active ports regardless of the saved
  `portVisibilityMode` value.
- Detailed View with `portVisibilityMode: 'all'` shows all ports and larger
  module boxes; with `'active'` shows only connected ports and correspondingly
  smaller, tightly-packed boxes.

---

## Security Considerations

None — no new inputs, no network calls, no change to what is persisted.

---

## Performance Considerations

`applyPortVisibility` itself is O(links + ports), negligible. The real cost is
that it now runs before `layoutLevelView`, so toggling the checkbox re-triggers
the full async ELK layout pass (per-subgraph ELK calls, subgraph-column
assignment, bounding-box computation) instead of an instant synchronous
filter. Correct box sizing requires ELK to see the true port count, which
only happens by re-running layout.
