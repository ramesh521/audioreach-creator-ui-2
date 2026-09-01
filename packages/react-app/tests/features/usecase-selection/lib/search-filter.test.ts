/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  buildUsecaseApiFilter,
  isComplexSearchTerm,
} from '~features/usecase-selection/lib/search-filter';

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

describe('isComplexSearchTerm — scope: All — no prefix', () => {
  it('returns false for a single plain term', () => {
    expect(isComplexSearchTerm('AANC', 'All')).toBe(false);
  });

  it('returns false for a plain AND expression', () => {
    expect(isComplexSearchTerm('AANC+SHARED_MIC_REF_PRESENT', 'All')).toBe(
      false,
    );
  });

  it('returns false for a plain OR expression', () => {
    expect(isComplexSearchTerm('AANC|BT_SCO', 'All')).toBe(false);
  });

  it('returns false for a plain grouped expression', () => {
    expect(isComplexSearchTerm('(AANC|BT_SCO)+HFP_Sink', 'All')).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(isComplexSearchTerm('', 'All')).toBe(false);
  });
});

describe('isComplexSearchTerm — scope: All — known prefixes present', () => {
  it('returns true when sg: prefix is present', () => {
    expect(isComplexSearchTerm('sg:42', 'All')).toBe(true);
  });

  it('returns true when cnt: prefix is present', () => {
    expect(isComplexSearchTerm('cnt:10', 'All')).toBe(true);
  });

  it('returns true when mod: prefix is present', () => {
    expect(isComplexSearchTerm('mod:0x4726', 'All')).toBe(true);
  });

  it('returns true when ss: prefix is present', () => {
    expect(isComplexSearchTerm('ss:0xF010002B', 'All')).toBe(true);
  });

  it('returns true when a prefix is embedded mid-expression', () => {
    expect(isComplexSearchTerm('AANC + sg:42', 'All')).toBe(true);
  });

  it('is case-insensitive when detecting prefixes (SG:42)', () => {
    expect(isComplexSearchTerm('SG:42', 'All')).toBe(true);
  });
});

describe('isComplexSearchTerm — scope other than All', () => {
  it('returns true for plain text with scope Subgraphs', () => {
    expect(isComplexSearchTerm('0x7656', 'Subgraphs')).toBe(true);
  });

  it('returns true for plain text with scope Containers', () => {
    expect(isComplexSearchTerm('0xE0000023', 'Containers')).toBe(true);
  });

  it('returns true for plain text with scope Modules', () => {
    expect(isComplexSearchTerm('Volume', 'Modules')).toBe(true);
  });

  it('returns true for plain text with scope Subsystems', () => {
    expect(isComplexSearchTerm('Rx_Devices', 'Subsystems')).toBe(true);
  });

  it('returns true even for empty input when scope is not All', () => {
    expect(isComplexSearchTerm('', 'Subgraphs')).toBe(true);
  });
});
