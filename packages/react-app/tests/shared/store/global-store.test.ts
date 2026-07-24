/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import {act, renderHook} from '@testing-library/react';

import {useGlobalStore} from '~shared/store/global-store';

describe('useGlobalStore — exclusive lock wiring', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('exposes setActiveExclusiveMode/releaseExclusiveMode on the composed store', () => {
    const acquired = useGlobalStore
      .getState()
      .setActiveExclusiveMode('proj-1', 'usecase-edit');

    expect(acquired).toBe(true);
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-1'],
    ).toBe('usecase-edit');

    useGlobalStore.getState().releaseExclusiveMode('proj-1', 'usecase-edit');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-1'],
    ).toBeUndefined();
  });

  it('reacts a project-scoped selector when that project`s lock changes', () => {
    const {result} = renderHook(() =>
      useGlobalStore((s) => s.activeExclusiveModeByProject['proj-1'] ?? 'none'),
    );
    expect(result.current).toBe('none');

    act(() => {
      useGlobalStore
        .getState()
        .setActiveExclusiveMode('proj-1', 'usecase-edit');
    });

    expect(result.current).toBe('usecase-edit');
  });

  it('does not change a project-1 selector when project-2`s lock changes', () => {
    const {result} = renderHook(() =>
      useGlobalStore((s) => s.activeExclusiveModeByProject['proj-1'] ?? 'none'),
    );

    act(() => {
      useGlobalStore
        .getState()
        .setActiveExclusiveMode('proj-2', 'discovery-wizard');
    });

    expect(result.current).toBe('none');
  });
});
