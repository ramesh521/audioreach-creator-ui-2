/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {LevelView} from '~entities/graph';

/**
 * Derives the collapse state for the "Expand Subgraphs" control, which
 * collapses/expands every subgraph at the currently-viewed level at once.
 *
 * Everything here reads the RAW LevelView's subgraphs[], never a
 * post-applyCollapses graph: applyCollapses moves collapsed subgraphs out of
 * subgraphs[] and into subgraphProxies[], so the collapsed graph yields an
 * incomplete id set.
 */

/** Ids of every subgraph at a level. */
export function allSubgraphIds(level: LevelView): number[] {
  return (level.subgraphs ?? []).map((sg) => sg.subgraphId);
}

/**
 * The collapse set a level should have for a given expandSubgraphs value:
 * empty when expanded, every subgraph id when collapsed.
 */
export function collapseSetForLevel(
  level: LevelView,
  expandSubgraphs: boolean,
): Set<number> {
  return expandSubgraphs ? new Set<number>() : new Set(allSubgraphIds(level));
}
