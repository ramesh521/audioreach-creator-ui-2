/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {useMemo, useState} from 'react';

import type {ProxyControlLink, ProxyDataLink} from '~entities/graph';
import type {
  SelectedEdgeRef,
  SelectedNodeRef,
} from '~features/usecase-visualizer';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {
  buildPropertyGroups,
  type PropertyGroupItem,
  type PropertyGroupType,
} from '~widgets/properties-panel/lib/selection-groups';

import {
  ContainerPropertiesCard,
  ControlLinkPropertiesCard,
  DataLinkPropertiesCard,
  ModulePropertiesCard,
  SubgraphPropertiesCard,
  SubsystemPropertiesCard,
  VirtualControlLinkPropertiesCard,
  VirtualDataLinkPropertiesCard,
} from './entity-cards';
import {CollapsibleCard} from './shared/collapsible-card';

export type ModulePortCountField =
  'maxControlPorts' | 'maxInputPorts' | 'maxOutputPorts';

export interface PropertiesPanelProps {
  graphData: UsecaseGraphData;
  isEditing: boolean;
  onContainerHeapUpdated?: (containerId: string) => Promise<void> | void;
  onContainerIdChange: (containerId: string, newId: string) => void;
  onModuleAliasChange: (moduleId: string, alias: string) => void;
  onModuleContainerChange: (moduleId: string, newContainerId: string) => void;
  onModulePortCountChange: (
    moduleId: string,
    field: ModulePortCountField,
    value: number,
  ) => void;
  onNavigateToNode: (nodeId: string) => void;
  onSubgraphNameChange: (id: string, name: string) => void;
  onSubsystemNameChange: (id: string, name: string) => void;
  onVirtualControlLinkRowDelete: (realControlLinkId: string) => void;
  onVirtualDataLinkRowDelete: (realDataLinkId: string) => void;
  projectId: string;
  selectedEdges: SelectedEdgeRef[];
  selectedNodes: SelectedNodeRef[];
  virtualControlLinks?: ProxyControlLink[];
  virtualDataLinks?: ProxyDataLink[];
}

export function PropertiesPanel({
  graphData,
  isEditing,
  onContainerHeapUpdated,
  onContainerIdChange,
  onModuleAliasChange,
  onModuleContainerChange,
  onModulePortCountChange,
  onNavigateToNode,
  onSubgraphNameChange,
  onSubsystemNameChange,
  onVirtualControlLinkRowDelete,
  onVirtualDataLinkRowDelete,
  projectId,
  selectedEdges,
  selectedNodes,
  virtualControlLinks = [],
  virtualDataLinks = [],
}: PropertiesPanelProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<
    Partial<Record<PropertyGroupType, boolean>>
  >({});
  const groups = useMemo(
    () =>
      buildPropertyGroups({
        graphData,
        selectedEdges,
        selectedNodes,
        virtualControlLinks,
        virtualDataLinks,
      }),
    [
      graphData,
      selectedEdges,
      selectedNodes,
      virtualControlLinks,
      virtualDataLinks,
    ],
  );

  if (groups.length === 0) {
    return (
      <div className="p-4 text-sm text-[var(--color-text-secondary)]">
        Select a node or edge to view properties
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {groups.map((group) => (
        <CollapsibleCard
          key={group.type}
          count={group.items.length}
          isCollapsed={collapsedGroups[group.type] ?? false}
          onToggle={() =>
            setCollapsedGroups((current) => ({
              ...current,
              [group.type]: !(current[group.type] ?? false),
            }))
          }
          title={group.label}
        >
          {group.items.map((item) =>
            renderPropertyCard({
              graphData,
              isEditing,
              item,
              onContainerHeapUpdated,
              onContainerIdChange,
              onModuleAliasChange,
              onModuleContainerChange,
              onModulePortCountChange,
              onNavigateToNode,
              onSubgraphNameChange,
              onSubsystemNameChange,
              onVirtualControlLinkRowDelete,
              onVirtualDataLinkRowDelete,
              projectId,
              type: group.type,
            }),
          )}
        </CollapsibleCard>
      ))}
    </div>
  );
}

function renderPropertyCard({
  graphData,
  isEditing,
  item,
  onContainerHeapUpdated,
  onContainerIdChange,
  onModuleAliasChange,
  onModuleContainerChange,
  onModulePortCountChange,
  onNavigateToNode,
  onSubgraphNameChange,
  onSubsystemNameChange,
  onVirtualControlLinkRowDelete,
  onVirtualDataLinkRowDelete,
  projectId,
  type,
}: {
  graphData: UsecaseGraphData;
  isEditing: boolean;
  item: PropertyGroupItem;
  onContainerHeapUpdated?: (containerId: string) => Promise<void> | void;
  onContainerIdChange: (containerId: string, newId: string) => void;
  onModuleAliasChange: (moduleId: string, alias: string) => void;
  onModuleContainerChange: (moduleId: string, newContainerId: string) => void;
  onModulePortCountChange: (
    moduleId: string,
    field: ModulePortCountField,
    value: number,
  ) => void;
  onNavigateToNode: (nodeId: string) => void;
  onSubgraphNameChange: (id: string, name: string) => void;
  onSubsystemNameChange: (id: string, name: string) => void;
  onVirtualControlLinkRowDelete: (realControlLinkId: string) => void;
  onVirtualDataLinkRowDelete: (realDataLinkId: string) => void;
  projectId: string;
  type: PropertyGroupType;
}) {
  switch (type) {
    case 'subgraphs':
      return (
        <SubgraphPropertiesCard
          key={`${type}:${item.systemId}`}
          graphData={graphData}
          isEditing={isEditing}
          onSubgraphNameChange={onSubgraphNameChange}
          projectId={projectId}
          subgraphId={item.systemId}
        />
      );
    case 'containers':
      return (
        <ContainerPropertiesCard
          key={`${type}:${item.systemId}`}
          containerId={item.systemId}
          graphData={graphData}
          isEditing={isEditing}
          onContainerHeapUpdated={onContainerHeapUpdated}
          onContainerIdChange={onContainerIdChange}
          projectId={projectId}
        />
      );
    case 'modules':
      return (
        <ModulePropertiesCard
          key={`${type}:${item.systemId}`}
          graphData={graphData}
          isEditing={isEditing}
          moduleId={item.systemId}
          onModuleAliasChange={onModuleAliasChange}
          onModuleContainerChange={onModuleContainerChange}
          onModulePortCountChange={onModulePortCountChange}
          projectId={projectId}
        />
      );
    case 'subsystems':
      return (
        <SubsystemPropertiesCard
          key={`${type}:${item.systemId}`}
          graphData={graphData}
          isEditing={isEditing}
          onSubsystemNameChange={onSubsystemNameChange}
          projectId={projectId}
          subsystemId={item.systemId}
        />
      );
    case 'dataLinks':
      return (
        <DataLinkPropertiesCard
          key={`${type}:${item.systemId}`}
          graphData={graphData}
          linkId={item.systemId}
        />
      );
    case 'controlLinks':
      return (
        <ControlLinkPropertiesCard
          key={`${type}:${item.systemId}`}
          graphData={graphData}
          isEditing={isEditing}
          linkId={item.systemId}
          projectId={projectId}
        />
      );
    case 'virtualDataLinks':
      return item.proxyDataLink ? (
        <VirtualDataLinkPropertiesCard
          key={`${type}:${item.proxyDataLink.id}`}
          graphData={graphData}
          onNavigateToNode={onNavigateToNode}
          onVirtualDataLinkRowDelete={onVirtualDataLinkRowDelete}
          proxyLink={item.proxyDataLink}
        />
      ) : null;
    case 'virtualControlLinks':
      return item.proxyControlLink ? (
        <VirtualControlLinkPropertiesCard
          key={`${type}:${item.proxyControlLink.id}`}
          graphData={graphData}
          onNavigateToNode={onNavigateToNode}
          onVirtualControlLinkRowDelete={onVirtualControlLinkRowDelete}
          proxyLink={item.proxyControlLink}
        />
      ) : null;
  }
}
