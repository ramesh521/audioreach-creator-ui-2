/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import '~features/graph-designer';

import type {GraphDesignerStore} from '~features/graph-designer/model/graph-designer-store';
import {useGlobalStore} from '~shared/store/global-store';
import {tabStoreRegistry} from '~shared/store/tab-store-registry';

describe('graph-designer tab store factory — cleanup releases the edit lock', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('releases the usecase-edit lock on tab close when the tab was in edit mode', () => {
    const store = tabStoreRegistry.createTabStore<GraphDesignerStore>(
      'tab-cleanup-1',
      'graph-designer',
      'proj-cleanup-1',
    );

    store.getState().enterEditMode();
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-cleanup-1'],
    ).toBe('usecase-edit');

    tabStoreRegistry.destroyTabStore('tab-cleanup-1');

    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-cleanup-1'],
    ).toBeUndefined();
  });

  it('is a no-op on tab close when the tab was never in edit mode', () => {
    const store = tabStoreRegistry.createTabStore<GraphDesignerStore>(
      'tab-cleanup-2',
      'graph-designer',
      'proj-cleanup-2',
    );
    expect(store.getState().mode).toBe('view');

    expect(() =>
      tabStoreRegistry.destroyTabStore('tab-cleanup-2'),
    ).not.toThrow();
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-cleanup-2'],
    ).toBeUndefined();
  });
});
