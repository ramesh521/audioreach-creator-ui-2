/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {LevelView, SubgraphNode} from '~entities/graph';
import {
  allSubgraphIds,
  collapseSetForLevel,
} from '~widgets/graph-designer/lib/subgraph-collapse';

function subgraphNode(subgraphId: number): SubgraphNode {
  return {
    height: 100,
    id: `subgraph-${subgraphId}`,
    label: `sg-${subgraphId}`,
    nodeKind: 'subgraph',
    subgraphId,
    width: 200,
    x: 0,
    y: 0,
  };
}

function levelWith(ids: number[]): LevelView {
  return {levelId: 'top', subgraphs: ids.map(subgraphNode)};
}

describe('allSubgraphIds', () => {
  it('returns every subgraphId from level.subgraphs', () => {
    expect(allSubgraphIds(levelWith([1, 5, 9]))).toEqual([1, 5, 9]);
  });

  it('returns an empty array when subgraphs is an empty array', () => {
    expect(allSubgraphIds(levelWith([]))).toEqual([]);
  });

  it('returns an empty array when subgraphs is absent', () => {
    expect(allSubgraphIds({levelId: 'top'})).toEqual([]);
  });
});

describe('collapseSetForLevel', () => {
  it('returns an empty set when expandSubgraphs is true', () => {
    expect(collapseSetForLevel(levelWith([1, 2]), true)).toEqual(new Set());
  });

  it('returns every subgraph id when expandSubgraphs is false', () => {
    expect(collapseSetForLevel(levelWith([1, 2]), false)).toEqual(
      new Set([1, 2]),
    );
  });
});
