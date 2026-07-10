/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {ProjectInfo} from '~entities/project';

export interface ProjectOpenResult {
  error?: string;
  project?: ProjectInfo;
  success: boolean;
}

export interface ProjectLoadingState {
  isLoading: boolean;
  message: string;
}

export interface ProjectOpenerHook {
  /** Current loading state */
  loadingState: ProjectLoadingState;
  /** Opens a recent project by project info */
  openRecentProject: (project: ProjectInfo) => Promise<void>;
  /** Opens a workspace project using file picker */
  openWorkspaceProject: () => Promise<void>;
}

export interface ProjectLifecycleHook {
  /** Handles project close with screenshot capture */
  handleProjectClose: (
    projectId: string,
    projectName: string,
  ) => Promise<boolean>;
  /** Screenshot registry for storing screenshot functions */
  screenshotRegistry: Map<string, () => Promise<string | null>>;
}

export interface ProjectSaverHook {
  /** Whether a save operation is currently in progress */
  isSaving: boolean;
  /** Save all open projects sequentially */
  saveAllProjects: () => Promise<void>;
  /** Save project to its current file path (Ctrl+S behaviour) */
  saveProject: (projectId: string, filePath: string) => Promise<void>;
  /** Save project to a user-selected path (Save As behaviour) */
  saveProjectAs: (projectId: string, currentFilePath: string) => Promise<void>;
}
