/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {UsecaseIdentifier} from './usecase.dto';

export interface UsecaseCategory {
  expanded: boolean;
  name: string;
  usecases: UsecaseIdentifier[];
}
