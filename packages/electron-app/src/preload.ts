/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {
  ConfigApi,
  ConfigResult,
  ElectronApi,
  KeyConfiguratorViewApi,
  LogViewApi,
  MruProjectInfo,
  MruStoreApi,
  OpenProjectFileResponseData,
  ProjectContextApi,
  ProjectFileApi,
  SaveValidationResultsResponseData,
} from '@audioreach-creator-ui/api-utils';
import {contextBridge, ipcRenderer} from 'electron';

const api: ElectronApi = {
  versions: {
    chromeVersion: () => process.versions.chrome || '',
    electronVersion: () => process.versions.electron || '',
    nodeVersion: () => process.versions.node || '',
  },
};

contextBridge.exposeInMainWorld('api', api);

// Project File API - new pattern with dedicated handlers
const projectFileApi: ProjectFileApi = {
  getModificationDate: (filepath: string) =>
    ipcRenderer.invoke(
      'project-file:get-modification-date',
      filepath,
    ) as Promise<Date | undefined>,
  openProjectFile: () =>
    ipcRenderer.invoke(
      'project-file:open',
    ) as Promise<OpenProjectFileResponseData>,
  saveValidationResults: (content: string, defaultFilename?: string) =>
    ipcRenderer.invoke(
      'project-file:save-validation-results',
      content,
      defaultFilename,
    ) as Promise<SaveValidationResultsResponseData>,
  showInExplorer: (filepath: string) =>
    ipcRenderer.invoke(
      'project-file:show-in-explorer',
      filepath,
    ) as Promise<void>,
};

contextBridge.exposeInMainWorld('projectFileApi', projectFileApi);

const configApi: ConfigApi = {
  loadConfigData: () =>
    ipcRenderer.invoke('load-config-data') as Promise<ConfigResult>,
  saveConfigData: (data: string) =>
    ipcRenderer.invoke('save-config-data', data) as Promise<ConfigResult>,
};

contextBridge.exposeInMainWorld('configApi', configApi);

const mruStoreApi: MruStoreApi = {
  addProject: (project: MruProjectInfo) =>
    ipcRenderer.invoke('mru:add-project', project) as Promise<boolean>,
  clearAll: () => ipcRenderer.invoke('mru:clear-all') as Promise<boolean>,
  getRecentProjects: () =>
    ipcRenderer.invoke('mru:get-recent-projects') as Promise<MruProjectInfo[]>,
  getStorePath: () =>
    ipcRenderer.invoke('mru:get-store-path') as Promise<string>,
  removeProject: (projectId: string) =>
    ipcRenderer.invoke('mru:remove-project', projectId) as Promise<boolean>,
  updateProjectImage: (projectId: string, image: string) =>
    ipcRenderer.invoke(
      'mru:update-project-image',
      projectId,
      image,
    ) as Promise<boolean>,
};

contextBridge.exposeInMainWorld('mruStoreApi', mruStoreApi);

// Key Configurator View API
const keyConfiguratorViewApi: KeyConfiguratorViewApi = {
  onToggleKeyConfiguratorView: (callback: () => void) => {
    ipcRenderer.on('menu:toggle-key-configurator-view', callback);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('menu:toggle-key-configurator-view', callback);
    };
  },
  updateKeyConfiguratorViewState: (isOpen: boolean) =>
    ipcRenderer.invoke('key-configurator-view:update-state', isOpen),
};

contextBridge.exposeInMainWorld(
  'keyConfiguratorViewApi',
  keyConfiguratorViewApi,
);

// Log View API
const logViewApi: LogViewApi = {
  onToggleLogView: (callback: () => void) => {
    ipcRenderer.on('menu:toggle-log-view', callback);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('menu:toggle-log-view', callback);
    };
  },
  updateLogViewState: (isOpen: boolean) =>
    ipcRenderer.invoke('log-view:update-state', isOpen),
};

contextBridge.exposeInMainWorld('logViewApi', logViewApi);

// Project Context API
const projectContextApi: ProjectContextApi = {
  setProjectContext: (isActive: boolean) =>
    ipcRenderer.invoke('project-context:set', isActive),
};

contextBridge.exposeInMainWorld('projectContextApi', projectContextApi);
