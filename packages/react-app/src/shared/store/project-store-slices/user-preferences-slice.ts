/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {ConfigFileManager} from '~shared/config/config-manager';
import {
  DEFAULT_USER_PREFERENCES,
  type UserPreferences,
} from '~shared/config/user-preferences-types';
import {logger} from '~shared/lib/logger';

import type {SliceStatus} from '../global-store.types';

export interface UserPreferencesSlice {
  /** Updates a single preference value at the given dot-notation path. */
  updateUserPreference: (path: string, value: unknown) => boolean;
  userPreferences: UserPreferences;
  userPreferencesStatus: SliceStatus;
}

export function createUserPreferencesSlice(
  set: (partial: Partial<UserPreferencesSlice>) => void,
  _get: () => UserPreferencesSlice,
  projectId: string,
): UserPreferencesSlice {
  return {
    updateUserPreference: (path: string, value: unknown): boolean => {
      const success = ConfigFileManager.instance.setUserPreference(
        projectId,
        path,
        value,
      );

      if (success) {
        const updated =
          ConfigFileManager.instance.getUserPreferences(projectId);
        set({userPreferences: updated});

        logger.debug('User preference updated', {
          action: 'update_user_preference',
          component: 'UserPreferencesSlice',
          projectId,
        });
      } else {
        logger.warn('Failed to update user preference', {
          action: 'update_user_preference',
          component: 'UserPreferencesSlice',
          projectId,
        });
      }

      return success;
    },

    userPreferences:
      ConfigFileManager.instance.getUserPreferences(projectId) ??
      DEFAULT_USER_PREFERENCES,

    // Set to 'ready' immediately because the preferences are fully loaded at
    // store creation time — so the project config entry already
    // exists in ConfigFileManager when the store is created.
    userPreferencesStatus: 'ready',
  };
}
