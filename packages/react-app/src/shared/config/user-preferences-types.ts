/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * User preferences for visualization settings
 */
export interface VisualizationPreferences {
  expandSubgraphs: boolean;
  highlightPPModules: boolean;
  showContainerIds: boolean;
  showControlLinks: boolean;
  showDanglingLinks: boolean;
  showMdfModules: boolean;
  showModuleInstanceIds: boolean;
  showSubgraphIds: boolean;
  simplifySubsystems: boolean;
  viewMode: 'compact' | 'detailed';
}

/**
 * User preferences for display settings
 */
export interface DisplayPreferences {
  portVisibilityMode: 'all' | 'active';
}

/**
 * User preferences for usecase settings
 */
export interface UsecasePreferences {
  namePreference: 'alias' | 'keyvalues' | 'values';
  selectedUsecases: string[];
  workflowLevel: 'subsystem-level' | 'usecase-level';
  workflowType: 'usecase-workflow' | 'system-workflow';
}

/**
 * Complete user preferences structure
 */
export interface UserPreferences {
  display: DisplayPreferences;
  usecases: UsecasePreferences;
  visualization: VisualizationPreferences;
}

/**
 * Default visualization preferences
 */
export const DEFAULT_VISUALIZATION_PREFERENCES: VisualizationPreferences = {
  expandSubgraphs: false,
  highlightPPModules: false,
  showContainerIds: false,
  showControlLinks: true,
  showDanglingLinks: true,
  showMdfModules: false,
  showModuleInstanceIds: false,
  showSubgraphIds: false,
  simplifySubsystems: false,
  viewMode: 'compact',
};

/**
 * Default display preferences
 */
export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  portVisibilityMode: 'active',
};

/**
 * Default usecase preferences
 */
export const DEFAULT_USECASE_PREFERENCES: UsecasePreferences = {
  namePreference: 'alias',
  selectedUsecases: [],
  workflowLevel: 'usecase-level',
  workflowType: 'usecase-workflow',
};

/**
 * Default user preferences (all categories)
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  display: DEFAULT_DISPLAY_PREFERENCES,
  usecases: DEFAULT_USECASE_PREFERENCES,
  visualization: DEFAULT_VISUALIZATION_PREFERENCES,
};
