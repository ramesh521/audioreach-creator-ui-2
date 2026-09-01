/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {SearchScopeOption} from '../model/usecase-selection-control-store';

// Single source of truth for the short-form prefixes (sg:, cnt:, mod:, ss:)
const PREFIX_FIELDS: [prefix: string, field: string][] = [
  ['sg', 'subgraphId:'],
  ['cnt', 'containerId:'],
  ['mod', 'spfModuleInstanceId:'],
  ['ss', 'subsystemId:'],
];

const PREFIX_TO_FIELD: [RegExp, string][] = PREFIX_FIELDS.map(
  ([prefix, field]) => [new RegExp(`\\b${prefix}:`, 'gi'), field],
);

// Field injected per scope when the selector isn't 'All' (user types bare
// values, e.g. Subgraphs + '0x7656' → 'subgraphId:0x7656').
const SCOPE_FIELD: Partial<Record<SearchScopeOption, string>> = {
  Containers: 'containerId',
  Modules: 'spfModuleInstanceId',
  Subgraphs: 'subgraphId',
  Subsystems: 'subsystemId',
};

const PREFIX_DETECTION_PATTERN = new RegExp(
  `\\b(${PREFIX_FIELDS.map(([prefix]) => prefix).join('|')}):`,
  'i',
);

/**
 * True when a scope isn't 'All', or * the text contains a known short prefix (sg:/cnt:/mod:/ss:)
 */
export function isComplexSearchTerm(
  searchTerm: string,
  scopeOption: SearchScopeOption,
): boolean {
  if (scopeOption !== 'All') {
    return true;
  }
  return PREFIX_DETECTION_PATTERN.test(searchTerm);
}

/**
 * Transforms raw search-box input into the filter string
 * Mapping: + → AND, | → OR, () kept as-is.
 *
 * Scope 'All': short prefixes (sg:/cnt:/mod:/ss:) are translated to API field
 * Scope other than 'All': any typed prefix is stripped, and the scope's field
 * is injected before every value token instead.
 *
 * e.g. buildUsecaseApiFilter('sg:42 + cnt:10', 'All') → 'subgraphId:42 AND containerId:10'
 *      buildUsecaseApiFilter('0x7656 + 30294', 'Subgraphs') → 'subgraphId:0x7656 AND subgraphId:30294'
 */
export function buildUsecaseApiFilter(
  rawInput: string,
  scopeOption: SearchScopeOption,
): string {
  let filter = rawInput.trim();
  if (!filter) {
    return '';
  }

  filter = filter.replace(/\s*\+\s*/g, ' AND ');
  filter = filter.replace(/\s*\|\s*/g, ' OR ');

  if (scopeOption !== 'All') {
    const scopeField = SCOPE_FIELD[scopeOption];
    if (scopeField) {
      for (const [regex] of PREFIX_TO_FIELD) {
        filter = filter.replace(regex, '');
      }
      // Tokens = anything that isn't AND, OR, or a parenthesis.
      filter = filter.replace(
        /\b(?!AND\b|OR\b)([^\s()]+)/g,
        `${scopeField}:$1`,
      );
    }
  } else {
    for (const [regex, field] of PREFIX_TO_FIELD) {
      filter = filter.replace(regex, field);
    }
  }

  filter = filter.replace(/\s{2,}/g, ' ').trim();

  return filter;
}
