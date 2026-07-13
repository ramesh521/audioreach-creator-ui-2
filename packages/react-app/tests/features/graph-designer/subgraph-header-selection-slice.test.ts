/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import {createStore} from 'zustand';

import {
  createSubgraphHeaderSelectionSlice,
  type SubgraphHeaderSelectionSlice,
} from '~features/graph-designer/model/subgraph-header-selection-slice';

function makeStore() {
  return createStore<SubgraphHeaderSelectionSlice>((set, get) =>
    createSubgraphHeaderSelectionSlice(set, get),
  );
}

describe('createSubgraphHeaderSelectionSlice — initializeHeaderSelection', () => {
  it('sets defaults for a subgraph not yet present', () => {
    const store = makeStore();

    store.getState().initializeHeaderSelection('sg-1', {'key-1': 'val-1'});

    expect(store.getState().headerSelectionsBySubgraphId['sg-1']).toEqual({
      keyValues: {'key-1': 'val-1'},
      subgraphId: 'sg-1',
    });
  });

  it('does not clobber an already-present subgraph selection', () => {
    const store = makeStore();

    store.getState().initializeHeaderSelection('sg-1', {'key-1': 'val-1'});
    store.getState().setHeaderKeyValue('sg-1', 'key-1', 'val-2');
    store.getState().initializeHeaderSelection('sg-1', {'key-1': 'val-1'});

    expect(
      store.getState().headerSelectionsBySubgraphId['sg-1'].keyValues['key-1'],
    ).toBe('val-2');
  });
});

describe('createSubgraphHeaderSelectionSlice — setHeaderKeyValue', () => {
  it('updates only the targeted key for the targeted subgraph', () => {
    const store = makeStore();

    store
      .getState()
      .initializeHeaderSelection('sg-1', {'key-1': 'val-1', 'key-2': 'val-2'});
    store.getState().initializeHeaderSelection('sg-2', {'key-1': 'val-1'});

    store.getState().setHeaderKeyValue('sg-1', 'key-1', 'val-9');

    expect(
      store.getState().headerSelectionsBySubgraphId['sg-1'].keyValues,
    ).toEqual({'key-1': 'val-9', 'key-2': 'val-2'});
    expect(
      store.getState().headerSelectionsBySubgraphId['sg-2'].keyValues,
    ).toEqual({'key-1': 'val-1'});
  });

  it('initializes the subgraph selection when setting a key on an unknown subgraph', () => {
    const store = makeStore();

    store.getState().setHeaderKeyValue('sg-1', 'key-1', 'val-1');

    expect(store.getState().headerSelectionsBySubgraphId['sg-1']).toEqual({
      keyValues: {'key-1': 'val-1'},
      subgraphId: 'sg-1',
    });
  });
});
