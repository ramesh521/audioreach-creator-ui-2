/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {useCallback} from 'react';

import {useProjectStoreShallow} from '~shared/store/project-store-context';

/**
 * React hook for accessing and updating user preferences.
 * Reads from and writes to the project-level Zustand store so that all
 * components sharing the same ProjectStoreContext see the same preferences
 * and re-render when they change.
 */
export function useUserPreferences() {
  const userPreferences = useProjectStoreShallow((s) => s.userPreferences);
  const storeUpdateUserPreference = useProjectStoreShallow(
    (s) => s.updateUserPreference,
  );

  /**
   * Updates a single preference value
   * @param path - Dot-notation path to the preference (e.g., 'visualization.showControlLinks')
   * @param value - The new value for the preference
   */
  const updatePreference = useCallback(
    (path: string, value: unknown) => storeUpdateUserPreference(path, value),
    [storeUpdateUserPreference],
  );

  /**
   * Gets the current value of a specific preference
   * @param path - Dot-notation path to the preference (e.g., 'visualization.showControlLinks')
   * @returns The current value of the preference
   */
  const getPreference = useCallback(
    (path: string): unknown => {
      const pathParts = path.split('.');
      let value: unknown = userPreferences;

      for (const part of pathParts) {
        if (value && typeof value === 'object' && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }

      return value;
    },
    [userPreferences],
  );

  return {
    getPreference,
    preferences: userPreferences,
    updatePreference,
  };
}
