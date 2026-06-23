/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {ProxyDataLink} from '~entities/graph';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {toHexId} from '~shared/lib/format';
import {getNodeInfo} from '~widgets/properties-panel/lib/node-info';

export interface VirtualDataLinkRow {
  /**
   * Real connection ID for the delete callback; empty string for subsystem
   * fallback.
   */
  connectionId: string;
  destInstanceId: string;
  destName: string;
  destNodeId: string;
  destPortId: string;
  sourceInstanceId: string;
  sourceName: string;
  sourceNodeId: string;
  sourcePortId: string;
}

export interface VirtualDataLinkMdfModule {
  moduleId: string;
  moduleInstanceId: string;
  name: string;
}

export interface VirtualDataLinkCardViewModel {
  kind: ProxyDataLink['kind'];
  mdfModules: VirtualDataLinkMdfModule[];
  rows: VirtualDataLinkRow[];
}

export function useVirtualDataLinkCardData(
  linkId: string,
  graphData: UsecaseGraphData,
  virtualDataLinks: ProxyDataLink[],
): VirtualDataLinkCardViewModel {
  const proxyLink = virtualDataLinks.find((vl) => vl.id === linkId);

  if (!proxyLink) {
    return {kind: 'standard', mdfModules: [], rows: []};
  }

  const {kind} = proxyLink;

  // Subsystem proxy links have no realConnectionIds — use proxy endpoint data.
  if (kind === 'subsystem' || proxyLink.realConnectionIds.length === 0) {
    const src = getNodeInfo(proxyLink.sourceNodeId, graphData);
    const dst = getNodeInfo(proxyLink.targetNodeId, graphData);
    return {
      kind,
      mdfModules: [],
      rows: [
        {
          connectionId: '',
          destInstanceId: dst.instanceId,
          destName: dst.name,
          destNodeId: proxyLink.targetNodeId,
          destPortId: toHexId(proxyLink.targetPortId),
          sourceInstanceId: src.instanceId,
          sourceName: src.name,
          sourceNodeId: proxyLink.sourceNodeId,
          sourcePortId: toHexId(proxyLink.sourcePortId),
        },
      ],
    };
  }

  const rows: VirtualDataLinkRow[] = proxyLink.realConnectionIds.flatMap(
    (realId) => {
      const conn = graphData.connections.find((c) => c.connectionId === realId);
      if (!conn) {
        return [];
      }
      const src = getNodeInfo(conn.sourceId, graphData);
      const dst = getNodeInfo(conn.destinationId, graphData);
      return [
        {
          connectionId: realId,
          destInstanceId: dst.instanceId,
          destName: dst.name,
          destNodeId: conn.destinationId,
          destPortId: toHexId(conn.destinationPortId),
          sourceInstanceId: src.instanceId,
          sourceName: src.name,
          sourceNodeId: conn.sourceId,
          sourcePortId: toHexId(conn.sourcePortId),
        },
      ];
    },
  );

  const mdfModules: VirtualDataLinkMdfModule[] =
    kind === 'mdf'
      ? (proxyLink.mdfModuleIds ?? []).map((modId) => {
          const m = graphData.moduleInstances[modId];
          return {
            moduleId: m?.moduleId ?? modId,
            moduleInstanceId: m?.moduleInstanceId ?? modId,
            name: m?.displayName ?? modId,
          };
        })
      : [];

  return {kind, mdfModules, rows};
}
