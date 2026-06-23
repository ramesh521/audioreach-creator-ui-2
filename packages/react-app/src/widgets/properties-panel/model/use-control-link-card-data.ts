/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {useEffect, useState} from 'react';

import {fetchControlLinkProperties} from '~entities/control-links/api/fetch-control-link-properties';
import type {ProxyControlLink} from '~entities/graph';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {toHexId} from '~shared/lib/format';
import {logger} from '~shared/lib/logger';
import type {ControlLinkPropertiesDto} from '~shared/lib/property.dto';
import {getNodeComponentInfo} from '~widgets/properties-panel/lib/node-info';

export interface ControlLinkCardCallbacks {
  onDeleteLink: (linkId: string) => void;
}

export interface ControlLinkCardViewModel {
  destComponentInfo: string;
  destPortId: string;
  error: string | null;
  isLoading: boolean;
  linkProperties: ControlLinkPropertiesDto | null;
  onDeleteLink: (linkId: string) => void;
  sourceComponentInfo: string;
  sourcePortId: string;
  updateHeap: (heapId: string) => void;
  updateIntent: (intentId: string, isUsed: boolean) => void;
}

export function useControlLinkCardData(
  linkId: string,
  graphData: UsecaseGraphData,
  projectId: string,
  callbacks: ControlLinkCardCallbacks,
  virtualControlLinks: ProxyControlLink[] = [],
): ControlLinkCardViewModel {
  const [linkProperties, setLinkProperties] =
    useState<ControlLinkPropertiesDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const virtualLink = virtualControlLinks.find((vl) => vl.id === linkId);
  // For virtual links, fetch properties using the real connection ID.
  // Subsystem virtual links have no real connection ID yet — skip the fetch.
  const fetchId = virtualLink
    ? (virtualLink.realConnectionIds[0] ?? null)
    : linkId;

  useEffect(() => {
    if (!fetchId) {
      return;
    }

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchControlLinkProperties(projectId, fetchId);
        if (result.success && result.data) {
          setLinkProperties(result.data);
        } else {
          const message =
            result.message ?? 'Failed to load control link properties';
          setError(message);
          logger.error('useControlLinkCardData: fetch failed', {
            action: 'fetch_control_link_properties',
            component: 'useControlLinkCardData',
            error: message,
          });
        }
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [projectId, fetchId]);

  // Resolve the connection to display: for virtual links use the real connection
  // if present, otherwise fall back to a direct lookup by linkId.
  const resolveId =
    virtualLink?.realConnectionIds[0] ?? (virtualLink ? null : linkId);
  const resolvedConnection = resolveId
    ? graphData.connections.find((c) => c.connectionId === resolveId)
    : undefined;

  // For subsystem virtual links (realConnectionIds is empty), use the
  // proxy's own endpoint fields directly.
  const sourceId =
    !resolvedConnection && virtualLink
      ? virtualLink.sourceNodeId
      : (resolvedConnection?.sourceId ?? '');
  const sourcePortId =
    !resolvedConnection && virtualLink
      ? virtualLink.sourcePortId
      : (resolvedConnection?.sourcePortId ?? '');
  const destinationId =
    !resolvedConnection && virtualLink
      ? virtualLink.targetNodeId
      : (resolvedConnection?.destinationId ?? '');
  const destinationPortId =
    !resolvedConnection && virtualLink
      ? virtualLink.targetPortId
      : (resolvedConnection?.destinationPortId ?? '');

  return {
    destComponentInfo: getNodeComponentInfo(destinationId, graphData),
    destPortId: toHexId(destinationPortId),
    error,
    isLoading,
    linkProperties,
    onDeleteLink: callbacks.onDeleteLink,
    sourceComponentInfo: getNodeComponentInfo(sourceId, graphData),
    sourcePortId: toHexId(sourcePortId),
    // Deferred — Task 14 (patch-control-link-properties) on hold.
    updateHeap: (_heapId) => {},
    updateIntent: (_intentId, _isUsed) => {},
  };
}
