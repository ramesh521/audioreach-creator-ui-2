/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';

export interface SubsystemCardCallbacks {
  onNameChange: (id: string, name: string) => void;
}

export interface SubsystemCardViewModel {
  subsystemId: string;
  subsystemName: string;
  updateName: (name: string) => void;
}

export function useSubsystemCardData(
  subsystemId: string,
  graphData: UsecaseGraphData,
  _projectId: string,
  _callbacks: SubsystemCardCallbacks,
): SubsystemCardViewModel {
  const subsystem = graphData.subsystems[subsystemId];

  return {
    subsystemId: subsystem?.subsystemId ?? subsystemId,
    subsystemName: subsystem?.subsystemName ?? '',
    // Deferred — Task 15 (patch-subsystem) on hold.
    updateName: (_name) => {},
  };
}
