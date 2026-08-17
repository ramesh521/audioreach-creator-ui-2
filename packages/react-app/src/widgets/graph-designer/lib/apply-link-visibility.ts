/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {LevelView} from '~entities/graph';

/**
 * Pure control/dangling link visibility filter.
 *
 * showControlLinks toggles all control links regardless of dangling state.
 * showDanglingLinks toggles any link (data or control) with isDangling
 * true, regardless of the control-link toggle. A non-dangling data link is
 * never affected by either flag.
 */
export function applyLinkVisibility(
  level: LevelView,
  showControlLinks: boolean,
  showDanglingLinks: boolean,
): LevelView {
  if (showControlLinks && showDanglingLinks) {
    return level;
  }

  const isVisible = (isDangling: boolean | undefined, isControl: boolean) =>
    (isDangling ? showDanglingLinks : true) &&
    (isControl ? showControlLinks : true);

  return {
    ...level,
    controlLinks: (level.controlLinks ?? []).filter((l) =>
      isVisible(l.isDangling, true),
    ),
    dataLinks: (level.dataLinks ?? []).filter((l) =>
      isVisible(l.isDangling, false),
    ),
  };
}
