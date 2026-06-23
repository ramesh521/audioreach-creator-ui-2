/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');
jest.mock('~entities/subgraphs/api/fetch-subgraph-properties');

import {renderHook, waitFor} from '@testing-library/react';

import {fetchSubgraphProperties} from '~entities/subgraphs/api/fetch-subgraph-properties';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import type {PropertyDto} from '~shared/lib/property.dto';
import {
  type SubgraphCardCallbacks,
  useSubgraphCardData,
} from '~widgets/properties-panel/model/use-subgraph-card-data';

const mockFetch = jest.mocked(fetchSubgraphProperties);

const mockProperties: PropertyDto[] = [
  {
    elements: [],
    hasDefinition: false,
    propertyId: 1,
    propertyName: 'Performance Mode',
    systemId: 'sys-1',
  },
];

const graphData: UsecaseGraphData = {
  connections: [],
  containers: {},
  moduleInstances: {},
  selectedUsecases: [],
  subgraphs: {
    'sg-1': {
      containers: [],
      subgraphId: 'sg-1',
      subgraphName: 'TestSubgraph',
      subgraphType: '',
    },
  },
  subsystems: {},
};

const callbacks: SubgraphCardCallbacks = {
  onNameChange: jest.fn(),
};

describe('useSubgraphCardData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({data: mockProperties, success: true});
  });

  it('fetches properties on mount with the correct subgraphId', async () => {
    renderHook(() =>
      useSubgraphCardData('sg-1', graphData, 'proj-1', callbacks),
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('proj-1', 'sg-1');
    });
  });

  it('exposes fetched properties in the view model', async () => {
    const {result} = renderHook(() =>
      useSubgraphCardData('sg-1', graphData, 'proj-1', callbacks),
    );

    await waitFor(() => {
      expect(result.current.properties).toEqual(mockProperties);
    });
  });

  it('exposes name and subgraphId from graphData', () => {
    const {result} = renderHook(() =>
      useSubgraphCardData('sg-1', graphData, 'proj-1', callbacks),
    );

    expect(result.current.name).toBe('TestSubgraph');
    expect(result.current.subgraphId).toBe('sg-1');
  });

  it('sets error state when fetch fails', async () => {
    mockFetch.mockResolvedValue({message: 'Not found', success: false});

    const {result} = renderHook(() =>
      useSubgraphCardData('sg-1', graphData, 'proj-1', callbacks),
    );

    await waitFor(() => {
      expect(result.current.error).toBe('Not found');
    });
  });

  it('sets isLoading false after fetch resolves', async () => {
    const {result} = renderHook(() =>
      useSubgraphCardData('sg-1', graphData, 'proj-1', callbacks),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('re-fetches when subgraphId changes', async () => {
    const graphData2: UsecaseGraphData = {
      ...graphData,
      subgraphs: {
        ...graphData.subgraphs,
        'sg-2': {
          containers: [],
          subgraphId: 'sg-2',
          subgraphName: 'Subgraph 2',
          subgraphType: '',
        },
      },
    };

    const {rerender} = renderHook(
      ({gd, id}) => useSubgraphCardData(id, gd, 'proj-1', callbacks),
      {initialProps: {gd: graphData, id: 'sg-1'}},
    );

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('proj-1', 'sg-1'),
    );

    rerender({gd: graphData2, id: 'sg-2'});

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('proj-1', 'sg-2'),
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('updateName and updateProperty can be called without throwing (deferred stubs)', () => {
    const {result} = renderHook(() =>
      useSubgraphCardData('sg-1', graphData, 'proj-1', callbacks),
    );

    expect(() => result.current.updateName('new name')).not.toThrow();
    expect(() =>
      result.current.updateProperty(1, 'elementName', 'value'),
    ).not.toThrow();
  });
});
