## Feature Overview and Strategic Fit
**Display Options in Side Nav:** The Graph Designer exposes a set of visualization controls — Show Control Links, Show Dangling Links, Highlight PP Modules, Expand Subgraphs, Simplified Subsystems, Show MDF Modules, Show all ports, Workflow (Usecase/System Workflow, with Subsystem/Usecase level nested under Usecase Workflow), Compact/Detailed View, and Usecase Name Preference. These controls need to be accessible to the user directly from the side nav. This feature adds a single Display Options entry to the Graph Designer side nav. Clicking it opens a QUI Popover panel containing Checkboxes and RadioGroup controls for all visualization settings. Each change writes immediately to the user preferences store, persisting the user's choices across sessions. These controls are Graph Designer-specific and do not appear in the side nav for any other tab.

---

## Architectural Impacts
*   `side-nav-types.ts` adds `import type {ReactNode} from 'react'` and adds an optional `popoverContent?: ReactNode` field to the `SideNavItem` interface to support items that open a QUI Popover instead of navigating
*   `arc-side-nav.tsx` adds a check in the leaf node renderer — if an item has `popoverContent`, it renders as a QUI Popover trigger instead of a standard nav link
*   `user-preferences-types.ts` adds `showMdfModules` and `viewMode` to `VisualizationPreferences`, and adds `workflowType` and `workflowLevel` to `UsecasePreferences`
*   `display-options-popover.tsx` new component containing checkboxes and RadioGroup controls for all visualization preferences
*   `graph-designer.tsx` connects to the user preferences system and registers the Display Options item in the side nav using the `SlidersHorizontal` icon.

---

## Assumptions
*   The user preferences system already exists and can be called to read and save preferences
*   Preferences are saved using a dot-notation path format (e.g. `visualization.showControlLinks`)
*   Display Options is only shown in the Graph Designer tab
*   Preferences are saved to a config file on disk and persist between sessions
*   The QUI Popover closes automatically when the user clicks outside it
*   The checkboxes and RadioGroup controls reflect the current saved preferences and update them directly
*   Both `Usecase Workflow` and `System Workflow` radios are always visible. `Subsystem level` / `Usecase level` render as a nested sub-choice under `Usecase Workflow` and collapse away when `System Workflow` is selected

---

## Default Values
All preferences fall back to these values when nothing has been saved yet for the active project (`shared/config/user-preferences-types.ts`):

| Preference (dot-notation path) | Default | Control |
| --- | --- | --- |
| `visualization.highlightPPModules` | `false` | Highlight PP Modules checkbox |
| `visualization.showControlLinks` | `true` | Show Control Links checkbox |
| `visualization.showDanglingLinks` | `true` | Show Dangling Links checkbox |
| `usecases.workflowType` | `'usecase-workflow'` | Workflow radio (Usecase Workflow / System Workflow) |
| `usecases.workflowLevel` | `'usecase-level'` | Nested Subsystem level / Usecase level radio |
| `display.portVisibilityMode` | `'active'` | Show all ports checkbox — unchecked by default, only visible in Detailed View |
| `visualization.viewMode` | `'compact'` | Compact View / Detailed View radio |
| `visualization.showSubgraphIds` | `false` | Show Subgraph IDs checkbox |
| `visualization.showContainerIds` | `false` | Show Container IDs checkbox |
| `visualization.showModuleInstanceIds` | `false` | Show Module Instance IDs checkbox |
| `visualization.expandSubgraphs` | `false` | Expand Subgraphs checkbox |
| `visualization.simplifySubsystems` | `false` | Simplified Subsystems checkbox |
| `visualization.showMdfModules` | `false` | Show MDF Modules checkbox |
| `usecases.namePreference` | `'alias'` | Usecase Name radio (Alias / Key Value(s) / Value(s)) |

Referenced from Error Handling below: if preferences have not loaded yet on first render, every control falls back to the value in this table.

---

## Requirements
| Title | User Story | Importance | Type |
| --- | --- | --- | --- |
| Display Options entry | As a user, I want a single Display Options entry in the side nav | Must Have | Functional |
| Popover opens on click | As a user, I want to click Display Options to open a Popover | Must Have | Functional |
| Show Control Links checkbox | As a user, I want to check or uncheck Show Control Links from the Popover | Must Have | Functional |
| Show Dangling Links checkbox | As a user, I want to check or uncheck Show Dangling Links from the Popover | Must Have | Functional |
| Highlight PP Modules checkbox | As a user, I want to check or uncheck Highlight PP Modules from the Popover | Must Have | Functional |
| Expand Subgraphs checkbox | As a user, I want to check or uncheck Expand Subgraphs from the Popover | Must Have | Functional |
| Simplified Subsystems checkbox | As a user, I want to check or uncheck Simplified Subsystems from the Popover. It is disabled only for the default combination — Usecase Workflow + Usecase level. It is enabled for Usecase Workflow + Subsystem level, and for System Workflow at either level. Enabling or disabling it never changes its checked value — it always shows whatever the user last checked or unchecked it to. | Must Have | Functional |
| Show MDF Modules checkbox | As a user, I want to check or uncheck Show MDF Modules from the Popover | Must Have | Functional |
| Port Visibility Mode checkbox | As a user, I want to check "Show all ports" to see all ports instead of only active ones, from the Popover. Only visible under Detailed View | Must Have | Functional |
| Compact View / Detailed View radio | As a user, I want to switch between Compact View and Detailed View from the Popover. **Compact View:** Nodes show names only — module/container/subgraph IDs are hidden for a smaller, denser, easier-to-read graph. **Detailed View:** Nodes show their full IDs (module instance, container, subgraph) alongside names, giving a complete view of each module. | Must Have | Functional |
| Workflow radio | As a user, I want to switch between Usecase Workflow and System Workflow from the Popover | Must Have | Functional |
| Usecase Name Preference radio | As a user, I want to switch between Alias, Key Value(s), and Value(s) name display from the Popover | Must Have | Functional |
| Preference persistence | As a user, I want my display choices to persist after I change them. Each change writes to the in-memory preferences store immediately, then a debounced (300ms) write flushes the full config to disk via `ConfigFileManager.save`; if the Popover closes before the debounce fires, the pending write flushes immediately on unmount instead of being dropped. | Must Have | Functional |
| Close on outside click | As a user, I want the Popover to close when I click outside it | Must Have | Functional |
| Graph Designer scope | As a user, I only want Display Options visible when I am in the Graph Designer tab | Must Have | Functional |

---

## User Interaction and Design
*   A single **Display Options** entry appears in the side nav only when the Graph Designer tab is active
*   Side nav collapsed: shows `SlidersHorizontal` icon only with a tooltip reading "Display Options"
*   Side nav expanded: shows `SlidersHorizontal` icon and "Display Options" label
*   Clicking Display Options opens a QUI Popover to the right of the side nav
*   The Popover has four sections: Graph View, Workflow, Graph Display, and Usecase Name
*   Checkboxes show the current on/off state; "Show all ports" only appears once Detailed View is selected
*   RadioGroup controls show the current selection
*   Every change writes immediately to the user preferences store (see Preference persistence above for the exact save mechanism)
*   Clicking anywhere outside the Popover closes it — any pending debounced write is flushed on close, so no change made just before closing is lost

**Popover UI (default state — Usecase Workflow / Usecase level / Compact View):**
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

**Same popover after selecting Subsystem level (still Usecase Workflow) — Simplified Subsystems becomes enabled, showing whatever it was last checked to:**
```
┌───────────────────────────────────────┐
│ WORKFLOW                               │
│ ● Usecase Workflow                     │
│     ● Subsystem level                  │
│     ○ Usecase level                    │
│ ○ System Workflow                      │
├───────────────────────────────────────┤
│ GRAPH DISPLAY                          │
│ ...                                     │
│ ☑ Simplified Subsystems (enabled)      │
│ ...                                     │
└───────────────────────────────────────┘
```

**Same popover after selecting System Workflow and Detailed View — Simplified Subsystems remains enabled with its last checked value (no forced state either way):**
```
┌───────────────────────────────────────┐
│ GRAPH VIEW                             │
│ ☐ Highlight PP Modules                 │
│ ☑ Show Control Links                   │
│ ☑ Show Dangling Links                  │
├───────────────────────────────────────┤
│ WORKFLOW                               │
│ ○ Usecase Workflow                     │
│ ● System Workflow                      │
│   (Subsystem/Usecase level hidden)     │
├───────────────────────────────────────┤
│ GRAPH DISPLAY                          │
│ ○ Compact View                         │
│ ● Detailed View                        │
│     ☐ Show Subgraph IDs                │
│     ☐ Show Container IDs               │
│     ☐ Show Module Instance IDs         │
│     ☐ Show all ports                   │
│ ☐ Expand Subgraphs                     │
│ ☑ Simplified Subsystems (enabled)      │
│ ☐ Show MDF Modules                     │
├───────────────────────────────────────┤
│ USECASE NAME                           │
│ ● Alias                                │
│ ○ Key Value(s)                         │
│ ○ Value(s)                             │
└───────────────────────────────────────┘
```

---

## Component Design
**New file:** `display-options-popover.tsx`
A QUI Popover that opens to the right of the side nav when the user clicks Display Options. Organized into four sections:

**Graph View** — three Checkboxes:
*   Highlight PP Modules
*   Show Control Links
*   Show Dangling Links

**Workflow** — a single `RadioGroup` with `Usecase Workflow` / `System Workflow`:
*   When `Usecase Workflow` is selected, a nested `RadioGroup` (`Subsystem level` / `Usecase level`) renders indented directly beneath it
*   When `System Workflow` is selected, the nested `RadioGroup` is not rendered

**Graph Display**:
*   Compact View / Detailed View — RadioGroup with two options
*   When Detailed View is selected: Show Subgraph IDs, Show Container IDs, Show Module Instance IDs, and Show all ports — four additional Checkboxes, indented under the Detailed View option. Show all ports maps to `display.portVisibilityMode` (`'all'` when checked, `'active'` when unchecked)
*   Expand Subgraphs — Checkbox, always visible
*   Simplified Subsystems — Checkbox. `disabled` is derived from the combination of `Workflow type` and `Workflow level`: disabled only for `Usecase Workflow` + `Usecase level` (the default); enabled for `Usecase Workflow` + `Subsystem level`, and for `System Workflow` regardless of level. No transition ever writes to the checked value itself — the checkbox always shows whatever the user last checked/unchecked it to, including while disabled. While disabled, a QUI Tooltip wraps the checkbox explaining why ("Select Subsystem level or System Workflow to enable")
*   Show MDF Modules — Checkbox

**Usecase Name** — RadioGroup with three options:
*   Alias
*   Key Value(s)
*   Value(s)

Each control reads the current saved preference and writes back immediately when the user makes a change.

---

## Database Design
Not applicable on frontend.

---

## Error Handling
*   If a preference fails to save — either the in-memory `updatePreference` write fails, or the debounced on-disk `ConfigFileManager.save` resolves `false` or rejects — a toast notification is shown to the user
*   If preferences have not loaded yet on first render, all controls fall back to the values in the Default Values table above

---

## Security Considerations
*   No network calls are made — all preferences are stored locally in a config file on disk
*   No free-text input from the user — all values come from fixed checkboxes and RadioGroup selections

---

## Performance Considerations
*   The side nav item list is only rebuilt when the user's preferences change
*   The QUI Popover content is not loaded until the user opens it for the first time — no cost while it is closed
*   Each preference change causes one re-render of the Popover only — no unnecessary updates
*   Disk writes are debounced (300ms) so rapid successive toggles collapse into a single `ConfigFileManager.save` call rather than one per click

---

## Testing Strategy
**Unit Tests:**
*   Popover renders all three Graph View checkboxes, all Graph Display controls, and all Radio options across the Workflow RadioGroup (and its nested sub-group), Compact/Detailed View, and the Usecase Name RadioGroup
*   Each checkbox/Radio calls `savePreference` with the correct preference path and new value on interaction
*   Each control reflects the current saved preference
*   Both `Usecase Workflow` and `System Workflow` radios are always present
*   `Subsystem level` / `Usecase level` are visible when `Usecase Workflow` is selected, hidden when `System Workflow` is selected, and reappear when switching back
*   Detailed-View-only checkboxes are hidden in Compact View and appear after switching to Detailed View
*   Simplified Subsystems is disabled for the default Usecase Workflow + Usecase level combination
*   Simplified Subsystems is enabled after selecting Subsystem level under Usecase Workflow
*   Simplified Subsystems is enabled after selecting System Workflow
*   Simplified Subsystems' checked value is never altered by any Workflow type/level transition — enabling, disabling, and re-enabling all preserve the last value the user set
*   A Tooltip explaining why Simplified Subsystems is disabled appears only while it is disabled
*   Show all ports is hidden outside Detailed View and saves `display.portVisibilityMode` as `'all'`/`'active'` when checked/unchecked
*   A toast notification is shown when a preference save fails
*   A pending debounced save flushes immediately when the Popover unmounts (verifies no change is lost on close)

**Integration Tests:**
*   Click Display Options → QUI Popover opens
*   Check/uncheck Show Control Links, Show MDF Modules → correct preference save triggered
*   Select Detailed View → correct preference save triggered, ID checkboxes and Show all ports appear
*   Select System Workflow → correct preference save triggered, Subsystem/Usecase level radios disappear, Simplified Subsystems becomes enabled (checked value unchanged)
*   Select Subsystem level / Usecase level (while Usecase Workflow is active) → correct preference save triggered; Simplified Subsystems enables on Subsystem level, disables on Usecase level, checked value unchanged either way
*   Select Alias / Key Value(s) / Value(s) → correct preference save triggered
*   Simulate preference save failure → toast notification appears
*   Click outside Popover → Popover closes
*   Switch to a non-Graph Designer tab → Display Options is not visible
*   Switch back to Graph Designer → Display Options reappears

**End-to-End equivalent:**
*   Uncheck Show Dangling Links / Show MDF Modules → close Popover → simulate reload → verify preference still off
*   Select Detailed View → close → reopen → verify still selected
*   Select System Workflow → close → reopen → verify still selected and the nested level radios stay hidden
*   Verify only one Radio option can be active per group at a time

---

## Open-Source Libraries
*   `ConfigFileManager` — reads and writes user preferences to the user preferences store
*   React — manages Popover state and re-renders when preferences change
*   `lucide-react` — provides the `SlidersHorizontal` icon for the Display Options side nav entry
*   QUI Popover — the Popover triggered by clicking Display Options
*   QUI Checkbox — the checkbox controls for boolean preference values in Graph View and Graph Display
*   QUI Radio — the RadioGroup controls for Workflow (and its nested level sub-group), Compact/Detailed View, and Usecase Name preference selections
*   QUI Tooltip — explains why Simplified Subsystems is disabled
*   QUI Toast Notification — displays a notification when a preference fails to save
