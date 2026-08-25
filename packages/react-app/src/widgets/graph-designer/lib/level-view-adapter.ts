/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  type ContainerNode,
  type ControlLink,
  type DataLink,
  EDGE_KIND,
  type LevelView,
  type ModuleNode,
  type ModuleShape,
  NODE_KIND,
  type Port,
  PORT_IO_TYPE,
  type ProxyControlLink,
  type ProxyDataLink,
  type SubgraphNode,
  type SubsystemNode,
} from '~entities/graph';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {NODE_DIMENSIONS} from '~features/usecase-visualizer';
import {logger} from '~shared/lib/logger';

import {containerNodeId, subgraphNodeId} from './node-id';

function resolveModuleShape(name: string): ModuleShape | undefined {
  const t = name.toLowerCase();
  if (
    t.includes('data log') ||
    t.includes('datalog') ||
    t.includes('logging')
  ) {
    return 'circle';
  }
  if (t.includes('source')) {
    return 'trapezoid-source';
  }
  if (t.includes('sink')) {
    return 'trapezoid-sink';
  }
  return undefined;
}

export function buildLevelViewFromGraphData(
  data: UsecaseGraphData,
  levelId: string,
): LevelView {
  const modules: ModuleNode[] = Object.values(data.moduleInstances).map((m) => {
    const ports: Port[] = [
      ...m.inputPorts
        .filter((p) => p.portType === 'data')
        .map(
          (p): Port => ({
            id: p.portId,
            name: p.portName,
            portIoType: PORT_IO_TYPE.INPUT,
          }),
        ),
      ...m.outputPorts
        .filter((p) => p.portType === 'data')
        .map(
          (p): Port => ({
            id: p.portId,
            name: p.portName,
            portIoType: PORT_IO_TYPE.OUTPUT,
          }),
        ),
      ...m.inputPorts
        .filter((p) => p.portType === 'control')
        .map(
          (p): Port => ({
            id: p.portId,
            name: p.portName,
            portIoType: PORT_IO_TYPE.CONTROL,
          }),
        ),
    ];

    return {
      height: 0,
      id: m.moduleInstanceId,
      label: m.displayName,
      meta: {systemId: m.moduleInstanceId},
      moduleId: Number(m.moduleId),
      moduleType: m.moduleType,
      nodeKind: NODE_KIND.MODULE,
      parentId: containerNodeId(m.containerId, m.subgraphId),
      ports,
      shape: resolveModuleShape(m.displayName),
      width: NODE_DIMENSIONS.module.minWidth,
      x: 0,
      y: 0,
    };
  });

  // Derive containers from the unique (containerId, subgraphId) pairs present
  // in moduleInstances. data.containers provides metadata (label) keyed by
  // containerId, but it has one entry per container entity â€” not one per
  // subgraph context. A container that spans multiple subgraphs needs a
  // separate ContainerNode per subgraph so every module has a valid parent.
  const containerMeta = new Map(
    Object.values(data.containers).map((c) => [c.containerId, c]),
  );
  const containersByKey = new Map<string, ContainerNode>();
  for (const m of Object.values(data.moduleInstances)) {
    const key = containerNodeId(m.containerId, m.subgraphId);
    if (containersByKey.has(key)) {
      continue;
    }
    if (!containerMeta.has(m.containerId)) {
      logger.warn(
        'buildLevelViewFromGraphData: no container metadata for containerId',
        {
          action: 'build_level_view',
          component: 'levelViewAdapter',
        },
      );
    }
    containersByKey.set(key, {
      containerId: Number(m.containerId),
      height: 0,
      id: key,
      label: `Container ${m.containerId}`,
      meta: {subgraphId: m.subgraphId, systemId: m.containerId},
      nodeKind: NODE_KIND.CONTAINER,
      parentId: subgraphNodeId(m.subgraphId),
      width: 0,
      x: 0,
      y: 0,
    });
  }
  // Build reverse index: subgraphId â†’ subsystem systemId.
  const subgraphToSubsystemId = new Map<string, string>();
  for (const ss of Object.values(data.subsystems)) {
    for (const sgId of ss.subgraphs) {
      subgraphToSubsystemId.set(sgId, ss.subsystemId);
    }
  }

  const subgraphs: SubgraphNode[] = Object.values(data.subgraphs).map((sg) => ({
    height: 0,
    id: subgraphNodeId(sg.subgraphId),
    label: sg.subgraphName,
    meta: {systemId: sg.subgraphId},
    nodeKind: NODE_KIND.SUBGRAPH,
    parentId: subgraphToSubsystemId.get(sg.subgraphId),
    subgraphId: Number(sg.subgraphId),
    width: 0,
    x: 0,
    y: 0,
  }));

  const subsystems: SubsystemNode[] = Object.values(data.subsystems).map(
    (ss) => {
      const ports: Port[] = [
        ...ss.dataPorts
          .filter((p) => p.direction === 'input')
          .map(
            (p): Port => ({
              id: p.portId,
              name: p.portName,
              portIoType: PORT_IO_TYPE.INPUT,
            }),
          ),
        ...ss.dataPorts
          .filter((p) => p.direction === 'output')
          .map(
            (p): Port => ({
              id: p.portId,
              name: p.portName,
              portIoType: PORT_IO_TYPE.OUTPUT,
            }),
          ),
        ...ss.controlPorts.map(
          (p): Port => ({
            id: p.portId,
            name: p.portName,
            portIoType: PORT_IO_TYPE.CONTROL,
          }),
        ),
      ];

      return {
        height: 0,
        // Subsystem systemIds are globally unique â€” no prefix needed unlike
        // container or subgraph ids which share a numeric namespace.
        id: ss.subsystemId,
        label: ss.subsystemName,
        meta: {systemId: ss.subsystemId},
        nodeKind: NODE_KIND.SUBSYSTEM,
        ports,
        subsystemId: ss.subsystemId,
        width: 0,
        x: 0,
        y: 0,
      };
    },
  );

  const dataLinks: DataLink[] = [];
  const controlLinks: ControlLink[] = [];
  const proxyDataLinks: ProxyDataLink[] = [];
  const proxyControlLinks: ProxyControlLink[] = [];

  for (const c of data.connections) {
    const isModuleToModule =
      c.sourceId in data.moduleInstances &&
      c.destinationId in data.moduleInstances;

    if (isModuleToModule) {
      if (c.connectionType === 'data') {
        dataLinks.push({
          edgeKind: EDGE_KIND.DATA,
          id: c.connectionId,
          meta: {systemId: c.connectionId},
          sourceNodeId: c.sourceId,
          sourcePortId: c.sourcePortId,
          targetNodeId: c.destinationId,
          targetPortId: c.destinationPortId,
        });
      } else {
        controlLinks.push({
          edgeKind: EDGE_KIND.CONTROL,
          id: c.connectionId,
          meta: {systemId: c.connectionId},
          sourceNodeId: c.sourceId,
          sourcePortId: c.sourcePortId,
          targetNodeId: c.destinationId,
          targetPortId: c.destinationPortId,
        });
      }
    } else if (c.connectionType === 'data') {
      // TODO: populate realConnectionIds once the backend exposes the
      // underlying real connection ID in the subsystem connection DTO.
      proxyDataLinks.push({
        edgeKind: EDGE_KIND.PROXY_DATA,
        id: c.connectionId,
        kind: 'subsystem',
        meta: {systemId: c.connectionId},
        realConnectionIds: [],
        sourceNodeId: c.sourceId,
        sourcePortId: c.sourcePortId,
        targetNodeId: c.destinationId,
        targetPortId: c.destinationPortId,
      });
    } else {
      // TODO: populate realConnectionIds once the backend exposes the
      // underlying real connection ID in the subsystem connection DTO.
      proxyControlLinks.push({
        edgeKind: EDGE_KIND.PROXY_CONTROL,
        id: c.connectionId,
        kind: 'subsystem',
        meta: {systemId: c.connectionId},
        realConnectionIds: [],
        sourceNodeId: c.sourceId,
        sourcePortId: c.sourcePortId,
        targetNodeId: c.destinationId,
        targetPortId: c.destinationPortId,
      });
    }
  }

  return {
    containers: [...containersByKey.values()],
    controlLinks,
    dataLinks,
    levelId,
    modules,
    proxyControlLinks,
    proxyDataLinks,
    subgraphs,
    subsystems,
  };
}
