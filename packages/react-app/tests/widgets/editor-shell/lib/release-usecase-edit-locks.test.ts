/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {useGlobalStore} from '~shared/store/global-store';
import {releaseAllUsecaseEditLocks} from '~widgets/editor-shell/lib/release-usecase-edit-locks';

jest.mock('~shared/lib/logger');

describe('releaseAllUsecaseEditLocks', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('releases every usecase-edit lock, leaving other modes untouched', () => {
    useGlobalStore.getState().setActiveExclusiveMode('proj-1', 'usecase-edit');
    useGlobalStore.getState().setActiveExclusiveMode('proj-2', 'usecase-edit');
    useGlobalStore
      .getState()
      .setActiveExclusiveMode('proj-3', 'discovery-wizard');

    releaseAllUsecaseEditLocks();

    const locks = useGlobalStore.getState().activeExclusiveModeByProject;
    expect(locks['proj-1']).toBeUndefined();
    expect(locks['proj-2']).toBeUndefined();
    expect(locks['proj-3']).toBe('discovery-wizard');
  });

  it('is a no-op when no usecase-edit lock is held', () => {
    expect(() => releaseAllUsecaseEditLocks()).not.toThrow();
    expect(useGlobalStore.getState().activeExclusiveModeByProject).toEqual({});
  });
});
