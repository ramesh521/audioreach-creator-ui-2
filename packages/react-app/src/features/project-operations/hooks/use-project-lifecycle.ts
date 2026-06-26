/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {useRef} from 'react';

import {ProjectImageService} from '~entities/project';
import {ConfigFileManager} from '~shared/config/config-manager';
import {logger} from '~shared/lib/logger';

import type {ProjectLifecycleHook} from '../model/types';

/**
 * Hook for managing project lifecycle events
 * Handles project close with screenshot capture
 */
export function useProjectLifecycle(): ProjectLifecycleHook {
  const screenshotRegistryRef = useRef<
    Map<string, () => Promise<string | null>>
  >(new Map());

  // Must run before the project is unmounted — screenshot capture requires a
  // live GraphDesigner.
  const handleProjectClose = async (
    projectId: string,
    projectName: string,
  ): Promise<boolean> => {
    logger.verbose(`Closing project: ${projectName}`, {
      action: 'close_project',
      component: 'useProjectLifecycle',
      projectId,
    });

    const screenshotFn = screenshotRegistryRef.current.get(projectId);

    const [screenshotResult, configResult] = await Promise.allSettled([
      screenshotFn
        ? ProjectImageService.captureAndSave(projectId, screenshotFn)
        : Promise.resolve(),
      ConfigFileManager.instance.archiveProjectConfig(projectId),
    ] as const);

    if (screenshotResult.status === 'rejected') {
      logger.error('Failed to capture screenshot during project close', {
        action: 'close_project',
        component: 'useProjectLifecycle',
        error:
          screenshotResult.reason instanceof Error
            ? screenshotResult.reason.message
            : String(screenshotResult.reason),
        projectId,
      });
      // Don't block close on screenshot failure
    }

    if (configResult.status === 'rejected') {
      logger.error('Failed to save project configuration during close', {
        action: 'close_project',
        component: 'useProjectLifecycle',
        error:
          configResult.reason instanceof Error
            ? configResult.reason.message
            : String(configResult.reason),
        projectId,
      });
      // Don't block close on config save failure
    } else if (!configResult.value) {
      logger.warn('Failed to archive project configuration', {
        action: 'close_project',
        component: 'useProjectLifecycle',
        projectId,
      });
    }

    screenshotRegistryRef.current.delete(projectId);
    return true;
  };

  return {
    handleProjectClose,
    screenshotRegistry: screenshotRegistryRef.current,
  };
}
