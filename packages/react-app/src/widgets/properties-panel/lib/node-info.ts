/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {toHexId} from '~shared/lib/format';

export function getNodeComponentInfo(
  nodeId: string,
  graphData: UsecaseGraphData,
): string {
  const m = graphData.moduleInstances[nodeId];
  if (m) {
    return `${m.displayName} (${toHexId(m.moduleInstanceId)})`;
  }
  const ss = graphData.subsystems[nodeId];
  if (ss) {
    return ss.subsystemName;
  }
  return nodeId;
}

export function getNodeInfo(
  nodeId: string,
  graphData: UsecaseGraphData,
): {instanceId: string; name: string} {
  const m = graphData.moduleInstances[nodeId];
  if (m) {
    return {instanceId: toHexId(m.moduleInstanceId), name: m.displayName};
  }
  const ss = graphData.subsystems[nodeId];
  if (ss) {
    return {instanceId: toHexId(ss.subsystemId), name: ss.subsystemName};
  }
  return {instanceId: nodeId, name: nodeId};
}
