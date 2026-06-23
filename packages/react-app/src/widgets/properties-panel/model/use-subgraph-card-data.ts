/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {useEffect, useState} from 'react';

import {fetchSubgraphProperties} from '~entities/subgraphs/api/fetch-subgraph-properties';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {logger} from '~shared/lib/logger';
import type {PropertyDto} from '~shared/lib/property.dto';

export interface SubgraphCardCallbacks {
  onNameChange: (id: string, name: string) => void;
}

export interface SubgraphCardViewModel {
  error: string | null;
  isLoading: boolean;
  name: string;
  properties: PropertyDto[];
  subgraphId: string;
  updateName: (name: string) => void;
  updateProperty: (
    propertyId: number,
    elementName: string,
    value: string,
  ) => void;
}

export function useSubgraphCardData(
  subgraphId: string,
  graphData: UsecaseGraphData,
  projectId: string,
  _callbacks: SubgraphCardCallbacks,
): SubgraphCardViewModel {
  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchSubgraphProperties(projectId, subgraphId);
        if (result.success && result.data) {
          setProperties(result.data);
        } else {
          const message =
            result.message ?? 'Failed to load subgraph properties';
          setError(message);
          logger.error('useSubgraphCardData: fetch failed', {
            action: 'fetch_subgraph_properties',
            component: 'useSubgraphCardData',
            error: message,
          });
        }
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [projectId, subgraphId]);

  const subgraph = graphData.subgraphs[subgraphId];

  return {
    error,
    isLoading,
    name: subgraph?.subgraphName ?? '',
    properties,
    subgraphId: subgraph?.subgraphId ?? subgraphId,
    // Deferred — Tasks 5/6 (patch-subgraph, patch-subgraph-properties) on hold.
    updateName: (_name) => {},
    updateProperty: (_propertyId, _elementName, _value) => {},
  };
}
