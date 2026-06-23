/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {
  Port,
  UsecaseGraphData,
} from '~features/graph-designer/model/graph-data-slice';

export interface ModuleCardCallbacks {
  onAliasChange: (moduleId: string, alias: string) => void;
  onContainerChange: (moduleId: string, newContainerId: string) => void;
  onPortCountChange: (
    moduleId: string,
    field: 'maxControlPorts' | 'maxInputPorts' | 'maxOutputPorts',
    value: number,
  ) => void;
}

export interface ModuleCardViewModel {
  alias: string;
  containerId: string;
  displayName: string;
  inputPorts: Port[];
  maxControlPorts: number;
  maxInputPorts: number;
  maxOutputPorts: number;
  moduleId: string;
  moduleInstanceId: string;
  moduleName: string;
  outputPorts: Port[];
  updateAlias: (alias: string) => void;
  updateContainer: (newContainerId: string) => void;
  updatePortCount: (
    field: 'maxControlPorts' | 'maxInputPorts' | 'maxOutputPorts',
    value: number,
  ) => void;
}

export function useModuleCardData(
  moduleId: string,
  graphData: UsecaseGraphData,
  _projectId: string,
  _callbacks: ModuleCardCallbacks,
): ModuleCardViewModel {
  const module = graphData.moduleInstances[moduleId];

  return {
    alias: module?.alias ?? '',
    containerId: module?.containerId ?? '',
    displayName: module?.displayName ?? '',
    inputPorts: module?.inputPorts ?? [],
    maxControlPorts: module?.maxControlPorts ?? 0,
    maxInputPorts: module?.maxInputPorts ?? 0,
    maxOutputPorts: module?.maxOutputPorts ?? 0,
    moduleId: module?.moduleId ?? moduleId,
    moduleInstanceId: module?.moduleInstanceId ?? '',
    moduleName: module?.moduleName ?? '',
    outputPorts: module?.outputPorts ?? [],
    // Deferred — Task 10 (patch-module) on hold.
    updateAlias: (_alias) => {},
    updateContainer: (_newContainerId) => {},
    updatePortCount: (_field, _value) => {},
  };
}
