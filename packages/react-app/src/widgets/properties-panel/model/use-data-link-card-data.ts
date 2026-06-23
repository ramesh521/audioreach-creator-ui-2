/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {toHexId} from '~shared/lib/format';
import {getNodeComponentInfo} from '~widgets/properties-panel/lib/node-info';

export interface DataLinkCardViewModel {
  destComponentInfo: string;
  destPortId: string;
  sourceComponentInfo: string;
  sourcePortId: string;
}

export function useDataLinkCardData(
  linkId: string,
  graphData: UsecaseGraphData,
): DataLinkCardViewModel {
  const connection = graphData.connections.find(
    (c) => c.connectionId === linkId,
  );

  return {
    destComponentInfo: getNodeComponentInfo(
      connection?.destinationId ?? '',
      graphData,
    ),
    destPortId: toHexId(connection?.destinationPortId ?? ''),
    sourceComponentInfo: getNodeComponentInfo(
      connection?.sourceId ?? '',
      graphData,
    ),
    sourcePortId: toHexId(connection?.sourcePortId ?? ''),
  };
}
