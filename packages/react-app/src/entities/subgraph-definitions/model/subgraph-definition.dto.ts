/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {EndPointLink} from '~entities/usecases/model/usecase-component.dto';
import type {KeyValuePairsInfo} from '~entities/usecases/model/usecase.dto';

/**
 * Subgraph data transfer object, as returned by `getAllSubgraphs(projectId)`.
 */
export interface SubgraphDto {
  deviceType: 'Device' | 'Device_PP' | 'Stream' | 'Stream_Device' | 'Stream_PP';
  id: number;
  name: string;
  relatedEndPointLinks: EndPointLink[];
  SGKV: KeyValuePairsInfo[];
  subgraphId: number;
  subGraphSharedType: 'None' | 'Exported' | 'Imported';
  systemId: string;
}
