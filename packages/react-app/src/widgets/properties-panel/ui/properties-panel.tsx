/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {useEffect, useMemo, useState} from 'react';

import {ChevronDown, ChevronRight} from 'lucide-react';

import {IconButton} from '@qualcomm-ui/react/button';

import {
  EDGE_KIND,
  NODE_KIND,
  type ProxyControlLink,
  type ProxyDataLink,
} from '~entities/graph';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import type {
  SelectedEdgeRef,
  SelectedNodeRef,
} from '~features/usecase-visualizer';
import {ContainerPropertiesCard} from '~widgets/properties-panel/ui/entity-cards/container-properties-card';
import {ControlLinkPropertiesCard} from '~widgets/properties-panel/ui/entity-cards/control-link-properties-card';
import {DataLinkPropertiesCard} from '~widgets/properties-panel/ui/entity-cards/data-link-properties-card';
import {ModulePropertiesCard} from '~widgets/properties-panel/ui/entity-cards/module-properties-card';
import {SubgraphPropertiesCard} from '~widgets/properties-panel/ui/entity-cards/subgraph-properties-card';
import {SubsystemPropertiesCard} from '~widgets/properties-panel/ui/entity-cards/subsystem-properties-card';
import {VirtualDataLinkPropertiesCard} from '~widgets/properties-panel/ui/entity-cards/virtual-data-link-properties-card';

export interface PropertiesPanelProps {
  diffPropertyKeys?: Record<string, string[]>;
  graphData: UsecaseGraphData;
  isEditing: boolean;
  onContainerIdChange: (containerId: string, newId: string) => void;
  onDeleteLink: (linkId: string) => void;
  onMergeSelectionsChange?: (selections: Record<string, string[]>) => void;
  onModuleAliasChange: (moduleId: string, alias: string) => void;
  onModuleContainerChange: (moduleId: string, newContainerId: string) => void;
  onModulePortCountChange: (
    moduleId: string,
    field: 'maxControlPorts' | 'maxInputPorts' | 'maxOutputPorts',
    value: number,
  ) => void;
  onNavigateToNode: (nodeId: string) => void;
  onSubgraphNameChange: (id: string, name: string) => void;
  onSubsystemNameChange: (id: string, name: string) => void;
  projectId: string;
  selectedEdges: SelectedEdgeRef[];
  selectedNodes: SelectedNodeRef[];
  virtualControlLinks?: ProxyControlLink[];
  virtualDataLinks?: ProxyDataLink[];
}

interface EntityGroup {
  ids: string[];
  label: string;
  type: string;
}

export function PropertiesPanel({
  diffPropertyKeys: _diffPropertyKeys,
  graphData,
  isEditing,
  onContainerIdChange,
  onDeleteLink,
  onMergeSelectionsChange,
  onModuleAliasChange,
  onModuleContainerChange,
  onModulePortCountChange,
  onNavigateToNode: _onNavigateToNode,
  onSubgraphNameChange,
  onSubsystemNameChange,
  projectId,
  selectedEdges,
  selectedNodes,
  virtualControlLinks = [],
  virtualDataLinks = [],
}: PropertiesPanelProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [mergeSelections, setMergeSelections] = useState<
    Record<string, string[]>
  >({});

  const groups = useMemo<EntityGroup[]>(() => {
    const subgraphs: string[] = [];
    const containers: string[] = [];
    const modules: string[] = [];
    const subsystems: string[] = [];

    for (const node of selectedNodes) {
      if (
        (node.nodeKind === NODE_KIND.SUBGRAPH ||
          node.nodeKind === NODE_KIND.SUBGRAPH_PROXY) &&
        graphData.subgraphs[node.systemId]
      ) {
        subgraphs.push(node.systemId);
      } else if (
        node.nodeKind === NODE_KIND.CONTAINER &&
        graphData.containers[node.systemId]
      ) {
        containers.push(node.systemId);
      } else if (
        node.nodeKind === NODE_KIND.MODULE &&
        graphData.moduleInstances[node.systemId]
      ) {
        modules.push(node.systemId);
      } else if (
        node.nodeKind === NODE_KIND.SUBSYSTEM &&
        graphData.subsystems[node.systemId]
      ) {
        subsystems.push(node.systemId);
      }
    }

    const dataLinks: string[] = [];
    const virtualDataLinkIds: string[] = [];
    const controlLinks: string[] = [];
    const virtualControlLinkIds: string[] = [];

    for (const edge of selectedEdges) {
      if (
        edge.edgeKind === EDGE_KIND.PROXY_DATA &&
        virtualDataLinks.some((vl) => vl.id === edge.id)
      ) {
        virtualDataLinkIds.push(edge.id);
      } else if (
        edge.edgeKind === EDGE_KIND.PROXY_CONTROL &&
        virtualControlLinks.some((vl) => vl.id === edge.id)
      ) {
        virtualControlLinkIds.push(edge.id);
      } else {
        const conn = graphData.connections.find(
          (c) => c.connectionId === edge.systemId,
        );
        if (conn?.connectionType === 'data') {
          dataLinks.push(edge.systemId);
        } else if (conn?.connectionType === 'control') {
          controlLinks.push(edge.systemId);
        }
      }
    }

    return [
      {ids: subgraphs, label: 'Subgraphs', type: 'subgraph'},
      {ids: containers, label: 'Containers', type: 'container'},
      {ids: modules, label: 'Modules', type: 'module'},
      {ids: subsystems, label: 'Subsystems', type: 'subsystem'},
      {ids: dataLinks, label: 'Data Links', type: 'data-link'},
      {ids: controlLinks, label: 'Control Links', type: 'control-link'},
      {
        ids: virtualDataLinkIds,
        label: 'Virtual Data Links',
        type: 'virtual-data-link',
      },
      {
        ids: virtualControlLinkIds,
        label: 'Virtual Control Links',
        type: 'virtual-control-link',
      },
    ].filter((g) => g.ids.length > 0);
  }, [
    graphData,
    selectedEdges,
    selectedNodes,
    virtualControlLinks,
    virtualDataLinks,
  ]);

  const allSelectedIds = useMemo(
    () => new Set([...selectedNodes, ...selectedEdges].map((ref) => ref.id)),
    [selectedEdges, selectedNodes],
  );

  useEffect(() => {
    setMergeSelections((prev) => {
      const hasStale = Object.keys(prev).some((id) => !allSelectedIds.has(id));
      if (!hasStale) {
        return prev;
      }
      return Object.fromEntries(
        Object.entries(prev).filter(([id]) => allSelectedIds.has(id)),
      );
    });
  }, [allSelectedIds]);

  useEffect(() => {
    onMergeSelectionsChange?.(mergeSelections);
  }, [mergeSelections, onMergeSelectionsChange]);

  function toggleGroup(type: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <div
        className="p-4 text-sm"
        style={{color: 'var(--color-text-neutral-secondary)'}}
      >
        No items selected.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {groups.map((group) => {
        const isCollapsed =
          groups.length > 1 && collapsedGroups.has(group.type);
        return (
          <div key={group.type}>
            {/* Group header — only shown for multi-type selections */}
            {groups.length > 1 && (
              <div
                className="mb-1 flex items-center gap-1"
                style={{color: 'var(--color-text-neutral-secondary)'}}
              >
                <IconButton
                  aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                  icon={
                    isCollapsed ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )
                  }
                  onClick={() => toggleGroup(group.type)}
                  variant="ghost"
                />
                <span className="text-xs font-semibold">
                  {group.label} ({group.ids.length})
                </span>
              </div>
            )}

            {!isCollapsed && (
              <div className="flex flex-col gap-2">
                {group.type === 'subgraph' &&
                  group.ids.map((id) => (
                    <SubgraphPropertiesCard
                      key={id}
                      callbacks={{onNameChange: onSubgraphNameChange}}
                      graphData={graphData}
                      isEditing={isEditing}
                      projectId={projectId}
                      subgraphId={id}
                    />
                  ))}

                {group.type === 'container' &&
                  group.ids.map((id) => (
                    <ContainerPropertiesCard
                      key={id}
                      callbacks={{onContainerIdChange}}
                      containerId={id}
                      graphData={graphData}
                      isEditing={isEditing}
                      projectId={projectId}
                    />
                  ))}

                {group.type === 'module' &&
                  group.ids.map((id) => (
                    <ModulePropertiesCard
                      key={id}
                      callbacks={{
                        onAliasChange: onModuleAliasChange,
                        onContainerChange: onModuleContainerChange,
                        onPortCountChange: onModulePortCountChange,
                      }}
                      graphData={graphData}
                      isEditing={isEditing}
                      moduleId={id}
                      projectId={projectId}
                    />
                  ))}

                {group.type === 'subsystem' &&
                  group.ids.map((id) => (
                    <SubsystemPropertiesCard
                      key={id}
                      callbacks={{onNameChange: onSubsystemNameChange}}
                      graphData={graphData}
                      isEditing={isEditing}
                      projectId={projectId}
                      subsystemId={id}
                    />
                  ))}

                {group.type === 'data-link' &&
                  group.ids.map((id) => (
                    <DataLinkPropertiesCard
                      key={id}
                      graphData={graphData}
                      linkId={id}
                    />
                  ))}

                {group.type === 'virtual-data-link' &&
                  group.ids.map((id) => (
                    <VirtualDataLinkPropertiesCard
                      key={id}
                      graphData={graphData}
                      isEditing={isEditing}
                      linkId={id}
                      onDeleteLink={onDeleteLink}
                      onNavigateToNode={_onNavigateToNode}
                      virtualDataLinks={virtualDataLinks}
                    />
                  ))}

                {group.type === 'control-link' &&
                  group.ids.map((id) => (
                    <ControlLinkPropertiesCard
                      key={id}
                      callbacks={{onDeleteLink}}
                      graphData={graphData}
                      isEditing={isEditing}
                      linkId={id}
                      projectId={projectId}
                      virtualControlLinks={virtualControlLinks}
                    />
                  ))}

                {group.type === 'virtual-control-link' &&
                  group.ids.map((id) => (
                    <ControlLinkPropertiesCard
                      key={id}
                      callbacks={{onDeleteLink}}
                      graphData={graphData}
                      isEditing={false}
                      isVirtual
                      linkId={id}
                      projectId={projectId}
                      virtualControlLinks={virtualControlLinks}
                    />
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
