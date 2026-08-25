/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {useGraphDesignerStoreShallow} from '~features/graph-designer/model/graph-designer-store-context';
import {
  PropertiesPanel,
  type PropertiesPanelProps,
} from '~widgets/properties-panel';

// Write callbacks are deferred until PATCH API tasks are unblocked.
// onNavigateToNode is deferred until the virtual link architecture is settled.
const NOOP = () => {};

interface GraphDesignerPropertiesPanelProps {
  projectId: string;
}

export function GraphDesignerPropertiesPanel({
  projectId,
}: GraphDesignerPropertiesPanelProps) {
  const {
    effectiveLevelView,
    graphData,
    isEditing,
    selectedEdges,
    selectedNodes,
  } = useGraphDesignerStoreShallow((s) => ({
    effectiveLevelView: s.effectiveLevelView,
    graphData: s.graphData,
    isEditing: s.isEditing,
    selectedEdges: s.selectedEdges,
    selectedNodes: s.selectedNodes,
  }));

  if (!graphData) {
    return null;
  }

  const panelProps: PropertiesPanelProps = {
    graphData,
    isEditing,
    onContainerIdChange: NOOP,
    onDeleteLink: NOOP,
    onModuleAliasChange: NOOP,
    onModuleContainerChange: NOOP,
    onModulePortCountChange: NOOP,
    onNavigateToNode: NOOP,
    onSubgraphNameChange: NOOP,
    onSubsystemNameChange: NOOP,
    projectId,
    selectedEdges,
    selectedNodes,
    virtualControlLinks: effectiveLevelView?.proxyControlLinks ?? [],
    virtualDataLinks: effectiveLevelView?.proxyDataLinks ?? [],
  };

  return <PropertiesPanel {...panelProps} />;
}
