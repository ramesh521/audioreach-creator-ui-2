/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');
jest.mock('~entities/containers/api/fetch-container-properties');
jest.mock('~entities/modules/api/fetch-module-properties');

import {renderHook, waitFor} from '@testing-library/react';

import {fetchContainerProperties} from '~entities/containers/api/fetch-container-properties';
import {fetchModuleProperties} from '~entities/modules/api/fetch-module-properties';
import type {
  ModuleInstance,
  UsecaseGraphData,
} from '~features/graph-designer/model/graph-data-slice';
import type {PropertyDto} from '~shared/lib/property.dto';
import {
  type ContainerCardCallbacks,
  useContainerCardData,
} from '~widgets/properties-panel/model/use-container-card-data';

const mockFetchContainer = jest.mocked(fetchContainerProperties);
const mockFetchModule = jest.mocked(fetchModuleProperties);

const MODULE_A = 'm-a';
const MODULE_B = 'm-b';

function makeModule(id: string): ModuleInstance {
  return {
    containerId: 'c-1',
    displayName: `Module ${id}`,
    inputPorts: [],
    moduleId: '100',
    moduleInstanceId: id,
    moduleName: `Module ${id}`,
    moduleType: 'audio',
    outputPorts: [],
    position: {x: 0, y: 0},
    subgraphId: 'sg-1',
  };
}

function makeModuleProps(id: string): PropertyDto[] {
  return [
    {
      elements: [],
      hasDefinition: false,
      propertyId: 1,
      propertyName: 'Heap',
      systemId: id,
    },
  ];
}

const graphDataWithBoth: UsecaseGraphData = {
  connections: [],
  containers: {
    'c-1': {
      containerId: 'c-1',
      containerName: 'Container 1',
      moduleInstances: [MODULE_A, MODULE_B],
      subgraphId: 'sg-1',
    },
  },
  moduleInstances: {
    [MODULE_A]: makeModule(MODULE_A),
    [MODULE_B]: makeModule(MODULE_B),
  },
  selectedUsecases: [],
  subgraphs: {},
  subsystems: {},
};

const graphDataWithoutB: UsecaseGraphData = {
  ...graphDataWithBoth,
  containers: {
    'c-1': {
      ...graphDataWithBoth.containers['c-1'],
      moduleInstances: [MODULE_A],
    },
  },
  moduleInstances: {[MODULE_A]: makeModule(MODULE_A)},
};

const callbacks: ContainerCardCallbacks = {
  onContainerIdChange: jest.fn(),
};

describe('useContainerCardData — deletion cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchContainer.mockResolvedValue({data: [], success: true});
    mockFetchModule.mockImplementation(async (_projectId, moduleId) => ({
      data: makeModuleProps(moduleId),
      success: true,
    }));
  });

  it('fetches properties for both modules on mount', async () => {
    renderHook(() =>
      useContainerCardData('c-1', graphDataWithBoth, 'proj-1', callbacks),
    );

    await waitFor(() => {
      expect(mockFetchModule).toHaveBeenCalledWith('proj-1', MODULE_A);
      expect(mockFetchModule).toHaveBeenCalledWith('proj-1', MODULE_B);
    });
  });

  it('evicts module B properties when B is removed from graphData.moduleInstances', async () => {
    const {rerender, result} = renderHook(
      ({gd}) => useContainerCardData('c-1', gd, 'proj-1', callbacks),
      {initialProps: {gd: graphDataWithBoth}},
    );

    // Wait for both module properties to be loaded
    await waitFor(() => {
      expect(result.current.moduleProperties[MODULE_A]).toBeDefined();
      expect(result.current.moduleProperties[MODULE_B]).toBeDefined();
    });

    // Remove module B from graphData
    rerender({gd: graphDataWithoutB});

    // Module B's properties should be evicted; A's should remain
    await waitFor(() => {
      expect(result.current.moduleProperties[MODULE_B]).toBeUndefined();
    });
    expect(result.current.moduleProperties[MODULE_A]).toBeDefined();
  });

  it('does not evict module A when only B is removed', async () => {
    const {rerender, result} = renderHook(
      ({gd}) => useContainerCardData('c-1', gd, 'proj-1', callbacks),
      {initialProps: {gd: graphDataWithBoth}},
    );

    await waitFor(() => {
      expect(result.current.moduleProperties[MODULE_A]).toBeDefined();
    });

    rerender({gd: graphDataWithoutB});

    await waitFor(() => {
      expect(result.current.moduleProperties[MODULE_B]).toBeUndefined();
    });

    expect(result.current.moduleProperties[MODULE_A]).toEqual(
      makeModuleProps(MODULE_A),
    );
  });
});
