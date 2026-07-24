/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {shouldResetSessionLocalMaps} from '~widgets/graph-designer/lib/session-local-maps';

describe('shouldResetSessionLocalMaps', () => {
  it('returns true on a transition into view mode', () => {
    expect(shouldResetSessionLocalMaps('view')).toBe(true);
  });

  it('returns false while staying in or transitioning into edit mode', () => {
    expect(shouldResetSessionLocalMaps('edit')).toBe(false);
  });
});
