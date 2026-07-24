/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {logger} from '~shared/lib/logger';

import type {
  ExclusiveLockSlice,
  ExclusiveUsecaseMode,
} from '../global-store.types';

export function createExclusiveLockSlice(
  set: (partial: Partial<ExclusiveLockSlice>) => void,
  get: () => ExclusiveLockSlice,
): ExclusiveLockSlice {
  return {
    activeExclusiveModeByProject: {},

    releaseAllOfMode: (mode: ExclusiveUsecaseMode): void => {
      const next = {...get().activeExclusiveModeByProject};
      let released = false;
      for (const [projectId, activeMode] of Object.entries(next)) {
        if (activeMode === mode) {
          delete next[projectId];
          released = true;
        }
      }
      if (!released) {
        return;
      }

      set({activeExclusiveModeByProject: next});

      logger.debug(`All exclusive locks released for mode: ${mode}`, {
        action: 'release_all_of_mode',
        component: 'ExclusiveLockSlice',
      });
    },

    releaseExclusiveMode: (
      projectId: string,
      mode: ExclusiveUsecaseMode,
    ): void => {
      const current = get().activeExclusiveModeByProject[projectId] ?? 'none';
      if (current !== mode) {
        return;
      }

      const next = {...get().activeExclusiveModeByProject};
      delete next[projectId];
      set({activeExclusiveModeByProject: next});

      logger.debug(`Exclusive mode released: ${mode}`, {
        action: 'release_exclusive_mode',
        component: 'ExclusiveLockSlice',
        projectId,
      });
    },

    setActiveExclusiveMode: (
      projectId: string,
      mode: ExclusiveUsecaseMode,
    ): boolean => {
      const current = get().activeExclusiveModeByProject[projectId] ?? 'none';
      if (current !== 'none') {
        logger.debug(
          `Exclusive mode acquisition rejected: requested ${mode}, held ${current}`,
          {
            action: 'set_active_exclusive_mode',
            component: 'ExclusiveLockSlice',
            projectId,
          },
        );
        return false;
      }

      set({
        activeExclusiveModeByProject: {
          ...get().activeExclusiveModeByProject,
          [projectId]: mode,
        },
      });

      logger.debug(`Exclusive mode acquired: ${mode}`, {
        action: 'set_active_exclusive_mode',
        component: 'ExclusiveLockSlice',
        projectId,
      });
      return true;
    },
  };
}
