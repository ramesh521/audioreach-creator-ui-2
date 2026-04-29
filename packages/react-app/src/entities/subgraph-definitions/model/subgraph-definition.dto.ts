/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Subgraph data transfer object
 */
export interface SubgraphDto {
  description?: string;
  name: string;
  subgraphId: number;
  subgraphType: string;
}
