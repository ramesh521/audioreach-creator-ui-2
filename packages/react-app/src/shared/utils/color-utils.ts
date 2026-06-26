/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {logger} from '~shared/lib/logger';

const COLOR_ID_MAP: Record<number, string> = {
  1: 'blue',
  2: 'green',
  3: 'grey',
  4: 'lavender',
  5: 'lime',
  6: 'magenta',
  7: 'mint',
  8: 'navy',
  9: 'orange',
  10: 'pink',
  11: 'purple',
  12: 'quartz',
  13: 'queen',
  14: 'quicksilver',
  15: 'quincy',
  16: 'red',
  17: 'teal',
  18: 'yellow',
  19: 'zinc',
  20: 'zircon',
};

export function getColorName(colorId: number): string {
  if (!COLOR_ID_MAP[colorId]) {
    const firstAvailableColor = Object.values(COLOR_ID_MAP)[0];
    logger.warn(
      `Invalid color ID: ${colorId}. Falling back to '${firstAvailableColor}'.`,
      {
        action: 'getColorName',
        component: 'color-utils',
      },
    );
    return firstAvailableColor;
  }
  return COLOR_ID_MAP[colorId];
}
