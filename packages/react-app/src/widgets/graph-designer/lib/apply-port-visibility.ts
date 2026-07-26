/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {LevelView} from '~entities/graph';

export function applyPortVisibility(
  level: LevelView,
  effectiveMode: 'active' | 'all',
): LevelView {
  if (effectiveMode === 'all') {
    return level;
  }

  const activePortIds = new Set<string>();
  for (const link of [
    ...(level.dataLinks ?? []),
    ...(level.controlLinks ?? []),
    ...(level.proxyDataLinks ?? []),
    ...(level.proxyControlLinks ?? []),
  ]) {
    activePortIds.add(`${link.sourceNodeId}:${link.sourcePortId}`);
    activePortIds.add(`${link.targetNodeId}:${link.targetPortId}`);
  }

  return {
    ...level,
    modules: (level.modules ?? []).map((m) => ({
      ...m,
      ports: m.ports.filter((p) => activePortIds.has(`${m.id}:${p.id}`)),
    })),
  };
}
