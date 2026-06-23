/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');
jest.mock(
  '~widgets/properties-panel/ui/entity-cards/container-properties-card',
  () => ({ContainerPropertiesCard: () => null}),
);
jest.mock(
  '~widgets/properties-panel/ui/entity-cards/control-link-properties-card',
  () => ({ControlLinkPropertiesCard: () => null}),
);
jest.mock(
  '~widgets/properties-panel/ui/entity-cards/data-link-properties-card',
  () => ({DataLinkPropertiesCard: () => null}),
);
jest.mock(
  '~widgets/properties-panel/ui/entity-cards/module-properties-card',
  () => ({ModulePropertiesCard: () => null}),
);
jest.mock(
  '~widgets/properties-panel/ui/entity-cards/subgraph-properties-card',
  () => ({SubgraphPropertiesCard: () => null}),
);
jest.mock(
  '~widgets/properties-panel/ui/entity-cards/subsystem-properties-card',
  () => ({SubsystemPropertiesCard: () => null}),
);
jest.mock(
  '~widgets/properties-panel/ui/entity-cards/virtual-control-link-properties-card',
  () => ({VirtualControlLinkPropertiesCard: () => null}),
);
jest.mock(
  '~widgets/properties-panel/ui/entity-cards/virtual-data-link-properties-card',
  () => ({VirtualDataLinkPropertiesCard: () => null}),
);

import {render, screen} from '@testing-library/react';

import type {
  ModuleInstance,
  UsecaseGraphData,
} from '~features/graph-designer/model/graph-data-slice';
import {
  PropertiesPanel,
  type PropertiesPanelProps,
} from '~widgets/properties-panel';

function makeModule(id: string): ModuleInstance {
  return {
    containerId: 'c-1',
    displayName: `Module ${id}`,
    inputPorts: [],
    moduleId: '100',
    moduleInstanceId: id,
    moduleName: `Module ${id}`,
    moduleType: 'audio',
    outputPorts: [],
    position: {x: 0, y: 0},
    subgraphId: 'sg-1',
  };
}

const graphData: UsecaseGraphData = {
  connections: [],
  containers: {
    'c-1': {
      containerId: 'c-1',
      containerName: 'Container 1',
      moduleInstances: [],
      subgraphId: 'sg-1',
    },
  },
  moduleInstances: {
    'm-1': makeModule('m-1'),
    'm-2': makeModule('m-2'),
    'm-3': makeModule('m-3'),
  },
  selectedUsecases: [],
  subgraphs: {
    'sg-1': {
      containers: [],
      subgraphId: 'sg-1',
      subgraphName: 'Subgraph 1',
      subgraphType: '',
    },
    'sg-2': {
      containers: [],
      subgraphId: 'sg-2',
      subgraphName: 'Subgraph 2',
      subgraphType: '',
    },
  },
  subsystems: {},
};

const baseProps: PropertiesPanelProps = {
  graphData,
  isEditing: false,
  onContainerIdChange: jest.fn(),
  onDeleteLink: jest.fn(),
  onModuleAliasChange: jest.fn(),
  onModuleContainerChange: jest.fn(),
  onModulePortCountChange: jest.fn(),
  onNavigateToNode: jest.fn(),
  onSubgraphNameChange: jest.fn(),
  onSubsystemNameChange: jest.fn(),
  projectId: 'proj-1',
  selectedEdgeIds: [],
  selectedNodeIds: [],
};

describe('PropertiesPanel — grouping', () => {
  it('shows "No items selected" when nothing is selected', () => {
    render(<PropertiesPanel {...baseProps} />);
    expect(screen.getByText('No items selected.')).toBeInTheDocument();
  });

  it('renders group headers with correct counts for multi-type selection', () => {
    render(
      <PropertiesPanel
        {...baseProps}
        selectedNodeIds={['sg-1', 'sg-2', 'c-1', 'm-1', 'm-2', 'm-3']}
      />,
    );

    expect(screen.getByText('Subgraphs (2)')).toBeInTheDocument();
    expect(screen.getByText('Containers (1)')).toBeInTheDocument();
    expect(screen.getByText('Modules (3)')).toBeInTheDocument();
    expect(screen.queryByText(/Subsystems/)).not.toBeInTheDocument();
  });

  it('does not render a group header for a single entity type selection', () => {
    render(
      <PropertiesPanel {...baseProps} selectedNodeIds={['sg-1', 'sg-2']} />,
    );

    // Only one group type — header should NOT be shown
    expect(screen.queryByText('Subgraphs (2)')).not.toBeInTheDocument();
    expect(screen.queryByText(/Containers/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Modules/)).not.toBeInTheDocument();
  });

  it('renders groups in fixed order: Subgraphs → Containers → Modules', () => {
    render(
      <PropertiesPanel
        {...baseProps}
        selectedNodeIds={['m-1', 'c-1', 'sg-1']}
      />,
    );

    const headers = screen
      .getAllByText(/\([0-9]+\)/)
      .map((el) => el.textContent ?? '');

    expect(headers[0]).toMatch(/Subgraphs/);
    expect(headers[1]).toMatch(/Containers/);
    expect(headers[2]).toMatch(/Modules/);
  });
});
