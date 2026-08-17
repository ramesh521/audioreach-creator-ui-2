/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {LevelView, ModuleNode} from '~entities/graph';
import {applyPpHighlight} from '~widgets/graph-designer/lib/apply-pp-highlight';

function moduleNode(id: string, moduleId: number): ModuleNode {
  return {
    height: 80,
    id,
    label: id,
    moduleId,
    moduleType: 'Mod',
    nodeKind: 'module',
    ports: [],
    width: 160,
    x: 0,
    y: 0,
  };
}

function baseLevel(): LevelView {
  return {
    dataLinks: [
      {
        edgeKind: 'data',
        id: 'd-1',
        sourceNodeId: 'module-1',
        sourcePortId: 'out-1',
        targetNodeId: 'module-2',
        targetPortId: 'in-1',
      },
    ],
    levelId: 'top',
    modules: [moduleNode('module-1', 1), moduleNode('module-2', 2)],
  };
}

describe('applyPpHighlight', () => {
  // Empty set: nothing to highlight, no-op — same LevelView reference returned
  it('returns the same reference when ppModuleIds is empty', () => {
    const level = baseLevel();
    expect(applyPpHighlight(level, new Set())).toBe(level);
  });

  // A module whose moduleId (as string) is in the set gets isPpModule: true
  it('stamps isPpModule: true on modules whose moduleId is in the set', () => {
    const out = applyPpHighlight(baseLevel(), new Set(['1']));

    const m1 = out.modules?.find((m) => m.id === 'module-1');
    const m2 = out.modules?.find((m) => m.id === 'module-2');
    expect(m1?.isPpModule).toBe(true);
    expect(m2?.isPpModule).toBeUndefined();
  });

  // A module not in the set is returned as the same object reference — only
  // matching modules get a new object.
  it('returns an unmatched module as the same object reference', () => {
    const level = baseLevel();
    const originalM2 = level.modules?.find((m) => m.id === 'module-2');

    const out = applyPpHighlight(level, new Set(['1']));
    const m2 = out.modules?.find((m) => m.id === 'module-2');

    expect(m2).toBe(originalM2);
  });

  // Non-module fields must pass through untouched
  it('leaves dataLinks and other non-module fields untouched', () => {
    const level = baseLevel();
    const out = applyPpHighlight(level, new Set(['1']));

    expect(out.dataLinks).toBe(level.dataLinks);
    expect(out.levelId).toBe('top');
  });
});
