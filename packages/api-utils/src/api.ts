/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {
  OpenProjectFileResponseData,
  ProjectFileApiRequestTypes,
  SaveValidationResultsResponseData,
} from './project-file-api.types';

export enum ApiRequest {
  GetProjectFileModificationDate = 'file-prop-get-mod-date',
  OpenProjectFile = 'open-project-file',
  ShowProjectFileInExplorer = 'show-project-file-in-explorer',
  SaveValidationResults = 'save-validation-results',
}

/**
 * Discriminated unions in TypeScript are used to represent a value that could be
 * one of a few different types. They are a way of adding more information to a union
 * type, so that the compiler can know which type of value is actually being used.
 * also see: packages/electron-app/main.ts
 */
export type ApiRequestType = ProjectFileApiRequestTypes;

export type ApiResponse<T = undefined> = {
  data: T;
  message: string;
  requestType: ApiRequest;
};

export interface Versions {
  chromeVersion: () => string;
  electronVersion: () => string;
  nodeVersion: () => string;
}

export interface ElectronApi {
  versions: Versions;
}

/** Project File API exposed to renderer process */
export interface ProjectFileApi {
  getModificationDate: (filepath: string) => Promise<Date | undefined>;
  openProjectFile: () => Promise<OpenProjectFileResponseData>;
  saveValidationResults: (
    content: string,
    defaultFilename?: string,
  ) => Promise<SaveValidationResultsResponseData>;
  showInExplorer: (filepath: string) => Promise<void>;
}

export type WindowWithApi = Window & {api: ElectronApi};

export interface ConfigResult {
  data?: string;
  message: string;
  status: boolean;
}

export interface ConfigApi {
  loadConfigData: () => Promise<ConfigResult>;
  saveConfigData: (data: string) => Promise<ConfigResult>;
}

/** Interface for project information stored in MRU */
export interface MruProjectInfo {
  description?: string;
  filepath: string;
  id: string;
  image?: string;
  lastModifiedDate?: string;
  name: string;
}

/** MRU Store API exposed to renderer process */
export interface MruStoreApi {
  addProject: (project: MruProjectInfo) => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  getRecentProjects: () => Promise<MruProjectInfo[]>;
  getStorePath: () => Promise<string>;
  removeProject: (projectId: string) => Promise<boolean>;
  updateProjectImage: (projectId: string, image: string) => Promise<boolean>;
}

/** Key Configurator View API exposed to renderer process */
export interface KeyConfiguratorViewApi {
  onToggleKeyConfiguratorView: (callback: () => void) => () => void;
  updateKeyConfiguratorViewState: (isOpen: boolean) => Promise<void>;
}

/** Log View API exposed to renderer process */
export interface LogViewApi {
  onToggleLogView: (callback: () => void) => () => void;
  updateLogViewState: (isOpen: boolean) => Promise<void>;
}

/** Project Context API exposed to renderer process */
export interface ProjectContextApi {
  setProjectContext: (isActive: boolean) => Promise<void>;
}
