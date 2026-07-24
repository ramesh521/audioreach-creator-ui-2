/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import {createStore} from 'zustand';

import {
  createEditSessionSlice,
  type EditSessionSlice,
} from '~features/graph-designer/model/edit-session-slice';
import {useGlobalStore} from '~shared/store/global-store';

function makeStore(projectId: string) {
  return createStore<EditSessionSlice>((set) =>
    createEditSessionSlice(set, projectId),
  );
}

describe('createEditSessionSlice — mode & exclusive lock', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('enters edit mode and acquires the exclusive lock when no lock is held', () => {
    const store = makeStore('proj-edit-1');

    const acquired = store.getState().enterEditMode();

    expect(acquired).toBe(true);
    expect(store.getState().mode).toBe('edit');
    expect(store.getState().usesSubsystemVariant).toBe(true);
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-edit-1'],
    ).toBe('usecase-edit');
  });

  it('fails to enter edit mode and stays in view mode when the lock is already held', () => {
    useGlobalStore
      .getState()
      .setActiveExclusiveMode('proj-edit-2', 'discovery-wizard');
    const store = makeStore('proj-edit-2');

    const acquired = store.getState().enterEditMode();

    expect(acquired).toBe(false);
    expect(store.getState().mode).toBe('view');
  });

  it('rejects a second enterEditMode() call without an intervening exitEditMode()', () => {
    const store = makeStore('proj-edit-3');

    const first = store.getState().enterEditMode();
    const second = store.getState().enterEditMode();

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(store.getState().mode).toBe('edit');
  });

  it('exitEditMode() releases the lock and returns to view mode', () => {
    const store = makeStore('proj-edit-4');
    store.getState().enterEditMode();

    store.getState().exitEditMode();

    expect(store.getState().mode).toBe('view');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-edit-4'],
    ).toBeUndefined();
  });

  it('allows re-entering edit mode for the same project after exitEditMode()', () => {
    const store = makeStore('proj-edit-5');
    store.getState().enterEditMode();
    store.getState().exitEditMode();

    const acquired = store.getState().enterEditMode();

    expect(acquired).toBe(true);
    expect(store.getState().mode).toBe('edit');
  });
});

describe('createEditSessionSlice — mutation lock flag', () => {
  it('starts with isMutating false and mode view', () => {
    const store = makeStore('proj-mut-1');

    expect(store.getState().isMutating).toBe(false);
    expect(store.getState().mode).toBe('view');
  });

  it('beginMutation() sets isMutating to true', () => {
    const store = makeStore('proj-mut-2');

    store.getState().beginMutation();

    expect(store.getState().isMutating).toBe(true);
  });

  it('endMutation() sets isMutating to false', () => {
    const store = makeStore('proj-mut-3');
    store.getState().beginMutation();

    store.getState().endMutation();

    expect(store.getState().isMutating).toBe(false);
  });
});

describe('EditSessionSlice — session-local bookkeeping maps', () => {
  it('starts with all four session-local maps/arrays empty', () => {
    const store = makeStore('proj-1');

    expect(store.getState().excludedLinks).toEqual([]);
    expect(Object.keys(store.getState().kvCasesById)).toHaveLength(0);
    expect(Object.keys(store.getState().pairLinksById)).toHaveLength(0);
    expect(Object.keys(store.getState().subgraphProvenanceById)).toHaveLength(
      0,
    );
  });

  it('resetSessionLocalMaps clears all four fields back to empty', () => {
    const store = makeStore('proj-1');
    store.setState({
      excludedLinks: [
        {
          connectionId: 'link-1',
          connectionType: 'data',
          fromModuleId: 'm1',
          fromPortId: 'p1',
          toModuleId: 'm2',
          toPortId: 'p2',
        },
      ],
      kvCasesById: {'sg-1': []},
      pairLinksById: {
        'link-2': {
          connectionType: 'data' as const,
          fromModuleId: 'm3',
          fromPortId: 'p3',
          id: 'link-2',
          sourceSubgraphId: 'sg-1',
          targetSubgraphId: 'sg-2',
          toModuleId: 'm4',
          toPortId: 'p4',
        },
      },
      subgraphProvenanceById: {'sg-1': 'pre-loaded' as const},
    });

    store.getState().resetSessionLocalMaps();

    expect(store.getState().excludedLinks).toEqual([]);
    expect(Object.keys(store.getState().kvCasesById)).toHaveLength(0);
    expect(Object.keys(store.getState().pairLinksById)).toHaveLength(0);
    expect(Object.keys(store.getState().subgraphProvenanceById)).toHaveLength(
      0,
    );
  });
});
