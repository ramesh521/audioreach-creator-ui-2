/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {buildUsecaseApiFilter} from '~features/usecase-selection/lib/search-filter';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildUsecaseApiFilter — empty / whitespace input', () => {
  it('returns empty string for empty input', () => {
    expect(buildUsecaseApiFilter('', 'All')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(buildUsecaseApiFilter('   ', 'All')).toBe('');
  });
});

describe('buildUsecaseApiFilter — scope: All — operator normalisation', () => {
  it('replaces + with AND', () => {
    expect(buildUsecaseApiFilter('a + b', 'All')).toBe('a AND b');
  });

  it('replaces | with OR', () => {
    expect(buildUsecaseApiFilter('a | b', 'All')).toBe('a OR b');
  });

  it('handles + without surrounding spaces', () => {
    expect(buildUsecaseApiFilter('a+b', 'All')).toBe('a AND b');
  });

  it('handles | without surrounding spaces', () => {
    expect(buildUsecaseApiFilter('a|b', 'All')).toBe('a OR b');
  });

  it('handles mixed + and | operators', () => {
    expect(buildUsecaseApiFilter('a + b | c', 'All')).toBe('a AND b OR c');
  });
});

describe('buildUsecaseApiFilter — scope: All — prefix translation', () => {
  it('translates sg: to subgraphId:', () => {
    expect(buildUsecaseApiFilter('sg:42', 'All')).toBe('subgraphId:42');
  });

  it('translates cnt: to containerId:', () => {
    expect(buildUsecaseApiFilter('cnt:10', 'All')).toBe('containerId:10');
  });

  it('translates mod: to spfModuleInstanceId:', () => {
    expect(buildUsecaseApiFilter('mod:0x4726', 'All')).toBe(
      'spfModuleInstanceId:0x4726',
    );
  });

  it('translates ss: to subsystemId:', () => {
    expect(buildUsecaseApiFilter('ss:0xF010002B', 'All')).toBe(
      'subsystemId:0xF010002B',
    );
  });

  it('translates multiple different prefixes in one expression', () => {
    expect(buildUsecaseApiFilter('sg:42 + cnt:10', 'All')).toBe(
      'subgraphId:42 AND containerId:10',
    );
  });

  it('is case-insensitive for prefixes (SG: → subgraphId:)', () => {
    expect(buildUsecaseApiFilter('SG:42', 'All')).toBe('subgraphId:42');
  });

  it('passes plain text (no prefix) through unchanged', () => {
    expect(buildUsecaseApiFilter('PCM', 'All')).toBe('PCM');
  });

  it('passes hex values without prefix through unchanged', () => {
    expect(buildUsecaseApiFilter('0xB0000006', 'All')).toBe('0xB0000006');
  });

  it('handles mixed prefixed and plain tokens', () => {
    expect(buildUsecaseApiFilter('sg:42 + PCM', 'All')).toBe(
      'subgraphId:42 AND PCM',
    );
  });
});

describe('buildUsecaseApiFilter — scope: All — parentheses preserved', () => {
  it('preserves parentheses in the output', () => {
    expect(buildUsecaseApiFilter('(sg:42 | sg:43) + cnt:10', 'All')).toBe(
      '(subgraphId:42 OR subgraphId:43) AND containerId:10',
    );
  });
});

describe('buildUsecaseApiFilter — scope: Subgraphs', () => {
  it('injects subgraphId: before a single token', () => {
    expect(buildUsecaseApiFilter('0x7656', 'Subgraphs')).toBe(
      'subgraphId:0x7656',
    );
  });

  it('injects subgraphId: before each AND token', () => {
    expect(buildUsecaseApiFilter('0x7656 + 30294', 'Subgraphs')).toBe(
      'subgraphId:0x7656 AND subgraphId:30294',
    );
  });

  it('injects subgraphId: before each OR token', () => {
    expect(buildUsecaseApiFilter('42 | 43', 'Subgraphs')).toBe(
      'subgraphId:42 OR subgraphId:43',
    );
  });

  it('injects subgraphId: inside parentheses', () => {
    expect(buildUsecaseApiFilter('(42 | 43) + 44', 'Subgraphs')).toBe(
      '(subgraphId:42 OR subgraphId:43) AND subgraphId:44',
    );
  });

  it('strips a typed sg: prefix before injecting the scope field', () => {
    expect(buildUsecaseApiFilter('sg:42', 'Subgraphs')).toBe('subgraphId:42');
  });

  it('strips a typed cnt: prefix before injecting the scope field', () => {
    expect(buildUsecaseApiFilter('cnt:10', 'Subgraphs')).toBe('subgraphId:10');
  });
});

describe('buildUsecaseApiFilter — scope: Containers', () => {
  it('injects containerId: before a single token', () => {
    expect(buildUsecaseApiFilter('0xE0000023', 'Containers')).toBe(
      'containerId:0xE0000023',
    );
  });

  it('injects containerId: before each AND token', () => {
    expect(buildUsecaseApiFilter('0xE0000023 + 0xE0000024', 'Containers')).toBe(
      'containerId:0xE0000023 AND containerId:0xE0000024',
    );
  });
});

describe('buildUsecaseApiFilter — scope: Modules', () => {
  it('injects spfModuleInstanceId: before a single token', () => {
    expect(buildUsecaseApiFilter('0x4A31', 'Modules')).toBe(
      'spfModuleInstanceId:0x4A31',
    );
  });

  it('injects spfModuleInstanceId: before each AND token', () => {
    expect(buildUsecaseApiFilter('0x4A31 + Volume', 'Modules')).toBe(
      'spfModuleInstanceId:0x4A31 AND spfModuleInstanceId:Volume',
    );
  });
});

describe('buildUsecaseApiFilter — scope: Subsystems', () => {
  it('injects subsystemId: before a single token', () => {
    expect(buildUsecaseApiFilter('0xF010002B', 'Subsystems')).toBe(
      'subsystemId:0xF010002B',
    );
  });

  it('injects subsystemId: before each OR token', () => {
    expect(buildUsecaseApiFilter('0xF010002B | 0xF010002C', 'Subsystems')).toBe(
      'subsystemId:0xF010002B OR subsystemId:0xF010002C',
    );
  });
});

describe('buildUsecaseApiFilter — whitespace normalisation', () => {
  it('collapses extra whitespace introduced by prefix stripping', () => {
    // After stripping "sg:" from "sg: 42", the space before 42 becomes double
    const result = buildUsecaseApiFilter('sg:  42', 'Subgraphs');
    expect(result).not.toMatch(/\s{2,}/);
  });

  it('trims leading and trailing whitespace from the result', () => {
    const result = buildUsecaseApiFilter('  sg:42  ', 'All');
    expect(result).toBe('subgraphId:42');
  });
});
