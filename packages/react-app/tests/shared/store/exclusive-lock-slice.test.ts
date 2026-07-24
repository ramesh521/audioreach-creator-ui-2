/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import {createStore} from 'zustand';

import {createExclusiveLockSlice} from '~shared/store/global-store-slices/exclusive-lock-slice';
import type {ExclusiveLockSlice} from '~shared/store/global-store.types';

function makeStore() {
  return createStore<ExclusiveLockSlice>((set, get) =>
    createExclusiveLockSlice(set, get),
  );
}

describe('createExclusiveLockSlice', () => {
  it('acquires the lock for a project with no active mode', () => {
    const store = makeStore();

    const acquired = store
      .getState()
      .setActiveExclusiveMode('proj-1', 'usecase-edit');

    expect(acquired).toBe(true);
    expect(store.getState().activeExclusiveModeByProject['proj-1']).toBe(
      'usecase-edit',
    );
  });

  it('rejects a second acquisition of the same mode for the same project', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');

    const acquired = store
      .getState()
      .setActiveExclusiveMode('proj-1', 'usecase-edit');

    expect(acquired).toBe(false);
    expect(store.getState().activeExclusiveModeByProject['proj-1']).toBe(
      'usecase-edit',
    );
  });

  it('rejects acquisition of a different mode while one is already held', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'discovery-wizard');

    const acquired = store
      .getState()
      .setActiveExclusiveMode('proj-1', 'usecase-edit');

    expect(acquired).toBe(false);
    expect(store.getState().activeExclusiveModeByProject['proj-1']).toBe(
      'discovery-wizard',
    );
  });

  it('does not let one project`s lock block a different project', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');

    const acquired = store
      .getState()
      .setActiveExclusiveMode('proj-2', 'usecase-edit');

    expect(acquired).toBe(true);
    expect(store.getState().activeExclusiveModeByProject['proj-1']).toBe(
      'usecase-edit',
    );
    expect(store.getState().activeExclusiveModeByProject['proj-2']).toBe(
      'usecase-edit',
    );
  });

  it('releases the lock when the released mode matches the currently held mode', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');

    store.getState().releaseExclusiveMode('proj-1', 'usecase-edit');

    expect(
      store.getState().activeExclusiveModeByProject['proj-1'],
    ).toBeUndefined();
  });

  it('does not release the lock when the released mode does not match the held mode', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');

    store.getState().releaseExclusiveMode('proj-1', 'discovery-wizard');

    expect(store.getState().activeExclusiveModeByProject['proj-1']).toBe(
      'usecase-edit',
    );
  });

  it('is a no-op when releasing a lock that is not held at all', () => {
    const store = makeStore();

    expect(() =>
      store.getState().releaseExclusiveMode('proj-1', 'usecase-edit'),
    ).not.toThrow();
    expect(
      store.getState().activeExclusiveModeByProject['proj-1'],
    ).toBeUndefined();
  });

  it('allows re-acquiring the same mode for the same project after release', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');
    store.getState().releaseExclusiveMode('proj-1', 'usecase-edit');

    const acquired = store
      .getState()
      .setActiveExclusiveMode('proj-1', 'usecase-edit');

    expect(acquired).toBe(true);
  });

  it('releaseAllOfMode releases every project holding that mode, leaving other modes untouched', () => {
    const store = makeStore();
    store.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');
    store.getState().setActiveExclusiveMode('proj-2', 'usecase-edit');
    store.getState().setActiveExclusiveMode('proj-3', 'discovery-wizard');

    store.getState().releaseAllOfMode('usecase-edit');

    const locks = store.getState().activeExclusiveModeByProject;
    expect(locks['proj-1']).toBeUndefined();
    expect(locks['proj-2']).toBeUndefined();
    expect(locks['proj-3']).toBe('discovery-wizard');
  });

  it('releaseAllOfMode is a no-op when no project holds that mode', () => {
    const store = makeStore();

    expect(() =>
      store.getState().releaseAllOfMode('usecase-edit'),
    ).not.toThrow();
    expect(store.getState().activeExclusiveModeByProject).toEqual({});
  });
});
