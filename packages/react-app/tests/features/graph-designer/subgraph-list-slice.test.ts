/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');
jest.mock('~entities/subgraph-definitions/api/subgraph-definition-api');

import {createStore} from 'zustand';

import {getAllSubgraphs} from '~entities/subgraph-definitions/api/subgraph-definition-api';
import type {SubgraphDto} from '~entities/subgraph-definitions/model/subgraph-definition.dto';
import {
  createSubgraphListSlice,
  type SubgraphListSlice,
} from '~features/graph-designer/model/subgraph-list-slice';

const mockGetAllSubgraphs = jest.mocked(getAllSubgraphs);

function makeStore(projectId: string) {
  return createStore<SubgraphListSlice>((set, get) =>
    createSubgraphListSlice(set, get, projectId),
  );
}

function makeSubgraphDto(overrides: Partial<SubgraphDto> = {}): SubgraphDto {
  return {
    changeInfo: {changeType: 'CREATE'},
    deviceType: 'Device',
    id: 1,
    name: 'sg',
    relatedEndPointLinks: [],
    scenarioType: 'Audio',
    SGKV: [],
    subgraphId: 1,
    subGraphSharedType: '',
    systemId: 'sys-sg-1',
    ...overrides,
  };
}

describe('createSubgraphListSlice — loadSubgraphList default filter', () => {
  it('selects every subgraph type by default when no cached filter exists for the project', async () => {
    const store = makeStore('proj-fresh');
    mockGetAllSubgraphs.mockResolvedValueOnce({
      data: [
        makeSubgraphDto({deviceType: 'Device', subgraphId: 1}),
        makeSubgraphDto({deviceType: 'Stream', subgraphId: 2}),
      ],
      message: undefined,
      success: true,
    });

    await store.getState().loadSubgraphList();

    expect(store.getState().selectedSubgraphTypes.sort()).toEqual([
      'Device',
      'Stream',
    ]);
    expect(store.getState().subgraphList).toHaveLength(2);
  });

  it('uses the cached filter instead of all types when one was previously set for the project', async () => {
    const store = makeStore('proj-cached');
    mockGetAllSubgraphs.mockResolvedValueOnce({
      data: [makeSubgraphDto({deviceType: 'Device', subgraphId: 1})],
      message: undefined,
      success: true,
    });
    store.getState().setSelectedSubgraphTypes(['Stream']);
    mockGetAllSubgraphs.mockResolvedValueOnce({
      data: [makeSubgraphDto({deviceType: 'Device', subgraphId: 1})],
      message: undefined,
      success: true,
    });

    await store.getState().loadSubgraphList();

    expect(store.getState().selectedSubgraphTypes).toEqual(['Stream']);
  });
});
