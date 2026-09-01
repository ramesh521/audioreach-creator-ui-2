/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {ChevronRight, Link, Trash2} from 'lucide-react';

import {EDGE_KIND, type AnyNode, NODE_KIND} from '~entities/graph';
import type {
  ContextMenuItem,
  ContextMenuTarget,
  VisualizerContextMenuConfig,
} from '~features/usecase-visualizer/model/visualizer.types';

import type {UsecaseGraphData} from '../model/graph-data-slice';
import type {GraphDesignerStore} from '../model/graph-designer-store';

import type {InnerActionOptions} from './module-operations';

type DeleteHandler = (
  get: () => GraphDesignerStore,
  id: string,
) => Promise<boolean>;

type EdgeTarget = Extract<
  ContextMenuTarget,
  | {kind: 'control-link'}
  | {kind: 'data-link'}
  | {kind: 'proxy-control-link'}
  | {kind: 'proxy-data-link'}
>;

type InnerDeleteHandler = (
  get: () => GraphDesignerStore,
  id: string,
  options?: InnerActionOptions,
) => Promise<boolean>;

export const DELETE_HANDLERS: Record<AnyNode['nodeKind'], DeleteHandler> = {
  container: (get, id) => get().deleteContainer(get, id),
  module: (get, id) => get().deleteModuleInstance(get, id),
  subgraph: (get, id) => get().deleteSubgraph(get, id),
  'subgraph-proxy': (get, id) => get().deleteSubgraph(get, id),
  subsystem: (get, id) => get().deleteSubsystem(get, id),
};

export const DELETE_HANDLERS_INNER: Record<
  AnyNode['nodeKind'],
  InnerDeleteHandler
> = {
  container: (get, id, options) => get().deleteContainerInner(get, id, options),
  module: (get, id, options) =>
    get().deleteModuleInstanceInner(get, id, options),
  subgraph: (get, id, options) => get().deleteSubgraphInner(get, id, options),
  'subgraph-proxy': (get, id, options) =>
    get().deleteSubgraphInner(get, id, options),
  subsystem: (get, id, options) => get().deleteSubsystemInner(get, id, options),
};

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function resolveContextMenuNodeId(target: ContextMenuTarget): string {
  if (!('node' in target)) {
    return '';
  }
  const systemId = optionalString(target.node.meta?.systemId);
  if (systemId) {
    return systemId;
  }
  switch (target.node.nodeKind) {
    case NODE_KIND.CONTAINER:
      return optionalString(target.node.meta?.containerSystemId) ?? target.node.id;
    case NODE_KIND.MODULE:
      return target.node.id;
    case NODE_KIND.SUBGRAPH:
    case NODE_KIND.SUBGRAPH_PROXY:
      return optionalString(target.node.meta?.subgraphSystemId) ?? target.node.id;
    case NODE_KIND.SUBSYSTEM:
      return target.node.subsystemId;
  }
}

export function resolveEdgeLinkType(target: EdgeTarget): 'control' | 'data' {
  return target.kind === 'control-link' || target.kind === 'proxy-control-link'
    ? EDGE_KIND.CONTROL
    : EDGE_KIND.DATA;
}

function hasAnySubsystemChildren(
  store: GraphDesignerStore,
  id: string,
): boolean {
  const subsystem = store.graphData?.subsystems[id];
  return (
    (subsystem?.subgraphs.length ?? 0) > 0 ||
    (subsystem?.childSubsystemIds.length ?? 0) > 0
  );
}

function isPairLink(store: GraphDesignerStore, connectionId: string): boolean {
  return Object.values(store.pairLinksById).some((pair) =>
    [...pair.dataLinks, ...pair.controlLinks].some(
      (link) => link.systemId === connectionId,
    ),
  );
}

function parentSubsystemIdOf(
  graphData: UsecaseGraphData | null,
  nodeId: string,
): string | null {
  if (!graphData) {
    return null;
  }
  const subsystem = graphData.subsystems[nodeId];
  if (subsystem) {
    return subsystem.parentSubsystemId ?? null;
  }
  return (
    Object.values(graphData.subsystems).find((candidate) =>
      candidate.subgraphs.includes(nodeId),
    )?.parentSubsystemId ?? null
  );
}

function buildPortItems(connectionInProgress: boolean): ContextMenuItem[] {
  if (connectionInProgress) {
    return [{id: 'end-connection', label: 'End connection'}];
  }
  return [{icon: Link, id: 'start-connection', label: 'Start connection'}];
}

export function buildContextMenuConfig(
  get: () => GraphDesignerStore,
): VisualizerContextMenuConfig {
  return {
    getItems: (target) => {
      const store = get();
      if (store.mode !== 'edit') {
        return [];
      }
      switch (target.kind) {
        case 'module':
        case 'container':
        case 'subgraph-proxy':
          return [{icon: Trash2, id: 'delete', label: 'Delete'}];
        case 'subgraph':
          return [
            {icon: Trash2, id: 'delete', label: 'Delete'},
            {id: 'move-to-subsystem', label: 'Move to Subsystem'},
            ...(target.node.parentId
              ? [{id: 'remove-from-subsystem', label: 'Remove from Subsystem'}]
              : []),
          ];
        case 'subsystem': {
          const hasChildren = hasAnySubsystemChildren(store, target.node.id);
          return [
            {
              disabled: hasChildren,
              icon: Trash2,
              id: 'delete',
              label: 'Delete',
              tooltip: hasChildren
                ? 'Subsystem must be empty before it can be deleted'
                : undefined,
            },
            {id: 'move-to-subsystem', label: 'Move to Subsystem'},
            ...(target.node.parentId
              ? [{id: 'remove-from-subsystem', label: 'Remove from Subsystem'}]
              : []),
            {icon: ChevronRight, id: 'expand', label: 'Expand'},
          ];
        }
        case 'port':
          return buildPortItems(target.connectionInProgress);
        case 'control-link':
        case 'data-link':
        case 'proxy-control-link':
        case 'proxy-data-link':
          return [
            {icon: Trash2, id: 'delete', label: 'Delete'},
            ...(isPairLink(store, target.edge.id)
              ? [{id: 'exclude-link', label: 'Exclude Link'}]
              : []),
          ];
      }
    },
    onAction: (actionId, target) => {
      const store = get();
      if ('node' in target) {
        const nodeId = resolveContextMenuNodeId(target);
        if (actionId === 'delete') {
          void DELETE_HANDLERS[target.node.nodeKind](get, nodeId);
          return;
        }
        if (actionId === 'move-to-subsystem') {
          // TODO: Add destination selection before enabling non-root moves.
          void store.moveToSubsystem(get, nodeId, null);
          return;
        }
        if (actionId === 'remove-from-subsystem') {
          void store.moveToSubsystem(
            get,
            nodeId,
            parentSubsystemIdOf(store.graphData, nodeId),
          );
          return;
        }
        if (actionId === 'expand') {
          void store.expandSubsystem(get, nodeId);
        }
        return;
      }
      if (target.kind === 'port') {
        return;
      }
      if (actionId === 'delete') {
        void store.deleteLink(get, target.edge.id, resolveEdgeLinkType(target));
      }
      if (actionId === 'exclude-link') {
        store.excludeLink(get, target.edge.id);
      }
    },
  };
}
