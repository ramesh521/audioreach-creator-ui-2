/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {LevelView} from '~entities/graph';

/**
 * Pure PP-module highlight stamp. Marks each module whose moduleId is in
 * ppModuleIds as isPpModule: true. Purely visual — no effect on node size,
 * so this runs post-layout, never triggering a relayout when toggled.
 */
export function applyPpHighlight(
  level: LevelView,
  ppModuleIds: ReadonlySet<string>,
): LevelView {
  if (ppModuleIds.size === 0) {
    return level;
  }

  return {
    ...level,
    modules: (level.modules ?? []).map((m) =>
      ppModuleIds.has(String(m.moduleId)) ? {...m, isPpModule: true} : m,
    ),
  };
}
