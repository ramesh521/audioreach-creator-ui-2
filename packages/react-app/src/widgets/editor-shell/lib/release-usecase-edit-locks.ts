/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {useGlobalStore} from '~shared/store/global-store';

/**
 * Releases every project's `'usecase-edit'` exclusive lock. Called from
 * `EditorShell`'s `beforeunload` handler to close the one release path the
 * per-tab cleanup (registered via `tabStoreRegistry.registerCleanup`, which
 * calls `exitEditMode()`) cannot cover: an app quit/reload tears down the
 * renderer without running that per-tab cleanup at all
 * (core-edit-session-design.md's "Lock release is wired into every
 * graceful close path" section).
 *
 * Does not touch `'discovery-wizard'`/`'diff-merge'` locks — releasing
 * those on app teardown is those features' own concern.
 */
export function releaseAllUsecaseEditLocks(): void {
  useGlobalStore.getState().releaseAllOfMode('usecase-edit');
}
