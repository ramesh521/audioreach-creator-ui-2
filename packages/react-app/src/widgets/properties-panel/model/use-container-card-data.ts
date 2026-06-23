/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {useEffect, useState} from 'react';

import {fetchContainerProperties} from '~entities/containers/api/fetch-container-properties';
import {fetchModuleProperties} from '~entities/modules/api/fetch-module-properties';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {logger} from '~shared/lib/logger';
import type {PropertyDto} from '~shared/lib/property.dto';

export interface ContainerCardCallbacks {
  onContainerIdChange: (id: string, newId: string) => void;
}

export interface ContainerCardViewModel {
  containerId: string;
  containerProperties: PropertyDto[];
  error: string | null;
  isLoading: boolean;
  moduleProperties: Record<string, PropertyDto[]>;
  updateContainerId: (newId: string) => void;
  updateContainerProperty: (
    propertyId: number,
    elementName: string,
    value: string,
  ) => void;
  updateContainerType: (type: string) => void;
  updateModuleHeap: (
    moduleId: string,
    propertyId: number,
    elementName: string,
    value: string,
  ) => void;
}

export function useContainerCardData(
  containerId: string,
  graphData: UsecaseGraphData,
  projectId: string,
  _callbacks: ContainerCardCallbacks,
): ContainerCardViewModel {
  const [containerProperties, setContainerProperties] = useState<PropertyDto[]>(
    [],
  );
  const [moduleProperties, setModuleProperties] = useState<
    Record<string, PropertyDto[]>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable string dep so the effect re-runs when module membership changes.
  const moduleIdsKey = (
    graphData.containers[containerId]?.moduleInstances ?? []
  ).join(',');

  useEffect(() => {
    const ids = moduleIdsKey.length > 0 ? moduleIdsKey.split(',') : [];

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [containerResult, ...moduleResultList] = await Promise.all([
          fetchContainerProperties(projectId, containerId),
          ...ids.map((id) => fetchModuleProperties(projectId, id)),
        ]);

        if (containerResult.success && containerResult.data) {
          setContainerProperties(containerResult.data);
        } else {
          const message =
            containerResult.message ?? 'Failed to load container properties';
          setError(message);
          logger.error('useContainerCardData: container fetch failed', {
            action: 'fetch_container_properties',
            component: 'useContainerCardData',
            error: message,
          });
        }

        const newModuleProps: Record<string, PropertyDto[]> = {};
        for (let i = 0; i < ids.length; i++) {
          const result = moduleResultList[i];
          if (result?.success && result.data) {
            newModuleProps[ids[i]] = result.data;
          }
        }
        setModuleProperties(newModuleProps);
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [projectId, containerId, moduleIdsKey]);

  // Evict cached module properties when a module is removed from graph data.
  useEffect(() => {
    setModuleProperties((prev) => {
      const activeIds = new Set(Object.keys(graphData.moduleInstances));
      const hasStale = Object.keys(prev).some((id) => !activeIds.has(id));
      if (!hasStale) {
        return prev;
      }
      return Object.fromEntries(
        Object.entries(prev).filter(([id]) => activeIds.has(id)),
      );
    });
  }, [graphData.moduleInstances]);

  const container = graphData.containers[containerId];

  return {
    containerId: container?.containerId ?? containerId,
    containerProperties,
    error,
    isLoading,
    moduleProperties,
    // Deferred — Tasks 8/9 (patch-container, patch-container-properties) on hold.
    updateContainerId: (_newId) => {},
    updateContainerProperty: (_propertyId, _elementName, _value) => {},
    updateContainerType: (_type) => {},
    // Deferred — Task 12 (patch-module-properties) on hold.
    updateModuleHeap: (_moduleId, _propertyId, _elementName, _value) => {},
  };
}
