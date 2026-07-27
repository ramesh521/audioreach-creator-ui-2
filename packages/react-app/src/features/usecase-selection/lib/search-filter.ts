/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {SearchScopeOption} from '../model/usecase-selection-control-store';

// ── Short prefix → API field mapping ─────────────────────────────────────────
// Only short-form prefixes are supported (sg:, cnt:, mod:, ss:).

const PREFIX_TO_FIELD: [RegExp, string][] = [
  [/\bsg:/gi, 'subgraphId:'],
  [/\bcnt:/gi, 'containerId:'],
  [/\bmod:/gi, 'spfModuleInstanceId:'],
  [/\bss:/gi, 'subsystemId:'],
];

// ── Scope → API field ─────────────────────────────────────────────────────────
//
// Partial<Record<SearchScopeOption, string>> explained:
//   - Record<SearchScopeOption, string> would require ALL 5 scope keys to be
//     present (including 'All', which has no corresponding API field).
//   - Partial<...> makes every key optional, so we can safely omit 'All'.
//
// Used when the scope selector is set to anything other than 'All':
// the user types bare values (no prefix) and the system injects the field.
// e.g. SCOPE_FIELD['Subgraphs'] → 'subgraphId'
//      → user types '0x7656 + 30294' → 'subgraphId:0x7656 AND subgraphId:30294'

const SCOPE_FIELD: Partial<Record<SearchScopeOption, string>> = {
  Containers: 'containerId',
  Modules: 'spfModuleInstanceId',
  Subgraphs: 'subgraphId',
  Subsystems: 'subsystemId',
  // 'All' intentionally omitted — no field injection for All scope
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Transforms the raw user input from the search box into the structured filter
 * string expected by GET /projects/{id}/usecases?filter=<result>.
 *
 * Operator mapping:
 *   +  →  AND
 *   |  →  OR
 *   () →  () (preserved as-is for grouping)
 *
 * Scope = 'All':
 *   Short prefixes are translated to API field names:
 *     sg:  → subgraphId:
 *     cnt: → containerId:
 *     mod: → spfModuleInstanceId:
 *     ss:  → subsystemId:
 *   Plain text (no prefix) is passed through unchanged.
 *
 * Scope ≠ 'All' (Subgraphs / Containers / Modules / Subsystems):
 *   No prefix is required from the user.
 *   Any typed short prefix is stripped first (graceful handling).
 *   The scope's API field is injected before every value token.
 *
 * Examples:
 *   buildUsecaseApiFilter('sg:42 + cnt:10', 'All')
 *     → 'subgraphId:42 AND containerId:10'
 *
 *   buildUsecaseApiFilter('0x7656 + 30294', 'Subgraphs')
 *     → 'subgraphId:0x7656 AND subgraphId:30294'
 *
 *   buildUsecaseApiFilter('(42 | 43) + 44', 'Subgraphs')
 *     → '(subgraphId:42 OR subgraphId:43) AND subgraphId:44'
 */
export function buildUsecaseApiFilter(
  rawInput: string,
  scopeOption: SearchScopeOption,
): string {
  let filter = rawInput.trim();
  if (!filter) {
    return '';
  }

  // Step 1: Normalize operators (preserve surrounding spaces)
  filter = filter.replace(/\s*\+\s*/g, ' AND ');
  filter = filter.replace(/\s*\|\s*/g, ' OR ');

  if (scopeOption !== 'All') {
    // Step 2a: Scope-specific mode
    const scopeField = SCOPE_FIELD[scopeOption];
    if (scopeField) {
      // Strip any typed short prefix — user shouldn't need it in scope mode,
      // but handle it gracefully if they type one anyway.
      for (const [regex] of PREFIX_TO_FIELD) {
        filter = filter.replace(regex, '');
      }
      // Inject the scope's field before every value token.
      // Tokens = anything that is not AND, OR, or a parenthesis.
      filter = filter.replace(
        /\b(?!AND\b|OR\b)([^\s()]+)/g,
        `${scopeField}:$1`,
      );
    }
  } else {
    // Step 2b: All scope — replace short prefixes with API field names
    for (const [regex, field] of PREFIX_TO_FIELD) {
      filter = filter.replace(regex, field);
    }
    // Plain text (no prefix) is passed through unchanged
  }

  // Collapse any extra whitespace introduced by stripping
  filter = filter.replace(/\s{2,}/g, ' ').trim();

  return filter;
}
