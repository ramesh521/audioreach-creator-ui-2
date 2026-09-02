/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

jest.mock(
  '~widgets/properties-panel/ui/entity-cards/subgraph-properties-card',
  () => ({
    SubgraphPropertiesCard: ({subgraphId}: {subgraphId: string}) => (
      <div>subgraph-card:{subgraphId}</div>
    ),
  }),
);

jest.mock(
  '~widgets/properties-panel/ui/entity-cards/container-properties-card',
  () => ({
    ContainerPropertiesCard: ({containerId}: {containerId: string}) => (
      <div>container-card:{containerId}</div>
    ),
  }),
);

jest.mock(
  '~widgets/properties-panel/ui/entity-cards/module-properties-card',
  () => ({
    ModulePropertiesCard: ({moduleId}: {moduleId: string}) => (
      <div>module-card:{moduleId}</div>
    ),
  }),
);

jest.mock(
  '~widgets/properties-panel/ui/entity-cards/subsystem-properties-card',
  () => ({
    SubsystemPropertiesCard: ({subsystemId}: {subsystemId: string}) => (
      <div>subsystem-card:{subsystemId}</div>
    ),
  }),
);

jest.mock(
  '~widgets/properties-panel/ui/entity-cards/data-link-properties-card',
  () => ({
    DataLinkPropertiesCard: ({linkId}: {linkId: string}) => (
      <div>data-link-card:{linkId}</div>
    ),
  }),
);

jest.mock(
  '~widgets/properties-panel/ui/entity-cards/control-link-properties-card',
  () => ({
    ControlLinkPropertiesCard: ({linkId}: {linkId: string}) => (
      <div>control-link-card:{linkId}</div>
    ),
  }),
);

jest.mock(
  '~widgets/properties-panel/ui/entity-cards/virtual-data-link-properties-card',
  () => ({
    VirtualDataLinkPropertiesCard: ({proxyLink}: {proxyLink: {id: string}}) => (
      <div>virtual-data-link-card:{proxyLink.id}</div>
    ),
  }),
);

jest.mock(
  '~widgets/properties-panel/ui/entity-cards/virtual-control-link-properties-card',
  () => ({
    VirtualControlLinkPropertiesCard: ({
      proxyLink,
    }: {
      proxyLink: {id: string};
    }) => <div>virtual-control-link-card:{proxyLink.id}</div>,
  }),
);

import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {render, screen} from '@testing-library/react';

import {
  EDGE_KIND,
  NODE_KIND,
  type ProxyControlLink,
  type ProxyDataLink,
} from '~entities/graph';
import {PropertiesPanel} from '~widgets/properties-panel';

import {makeGraphData} from './entity-cards/test-graph-data';

const callbacks = {
  onContainerIdChange: jest.fn(),
  onModuleAliasChange: jest.fn(),
  onModuleContainerChange: jest.fn(),
  onModulePortCountChange: jest.fn(),
  onNavigateToNode: jest.fn(),
  onSubgraphNameChange: jest.fn(),
  onSubsystemNameChange: jest.fn(),
  onVirtualControlLinkRowDelete: jest.fn(),
  onVirtualDataLinkRowDelete: jest.fn(),
};

const proxyDataLink: ProxyDataLink = {
  edgeKind: EDGE_KIND.PROXY_DATA,
  id: 'proxy-dl-1',
  kind: 'standard',
  realConnectionIds: ['dl-1'],
  sourceNodeId: 'mod-1',
  sourcePortId: 'out-1',
  targetNodeId: 'mod-2',
  targetPortId: 'in-2',
};

const proxyControlLink: ProxyControlLink = {
  edgeKind: EDGE_KIND.PROXY_CONTROL,
  id: 'proxy-cl-1',
  realConnectionIds: ['cl-1'],
  sourceNodeId: 'mod-1',
  sourcePortId: 'ctl-1',
  targetNodeId: 'mod-2',
  targetPortId: 'ctl-2',
};

describe('PropertiesPanel', () => {
  it('renders the empty state when no property groups resolve', () => {
    render(
      <PropertiesPanel
        {...callbacks}
        graphData={makeGraphData()}
        isEditing={false}
        projectId="proj-1"
        selectedEdges={[]}
        selectedNodes={[]}
      />,
    );

    expect(
      screen.getByText('Select a node or edge to view properties'),
    ).toBeInTheDocument();
  });

  it('renders grouped cards in descriptor order', () => {
    render(
      <PropertiesPanel
        {...callbacks}
        graphData={makeGraphData()}
        isEditing
        projectId="proj-1"
        selectedEdges={[
          {edgeKind: EDGE_KIND.CONTROL, id: 'cl-1', systemId: 'cl-1'},
          {edgeKind: EDGE_KIND.PROXY_DATA, id: 'proxy-dl-1', systemId: 'dl-1'},
          {
            edgeKind: EDGE_KIND.PROXY_CONTROL,
            id: 'proxy-cl-1',
            systemId: 'cl-1',
          },
        ]}
        selectedNodes={[
          {id: 'sg-1', nodeKind: NODE_KIND.SUBGRAPH, systemId: 'sg-1'},
          {id: 'cnt-1', nodeKind: NODE_KIND.CONTAINER, systemId: 'cnt-1'},
          {id: 'mod-2', nodeKind: NODE_KIND.MODULE, systemId: 'mod-2'},
          {id: 'mod-1', nodeKind: NODE_KIND.MODULE, systemId: 'mod-1'},
        ]}
        virtualControlLinks={[proxyControlLink]}
        virtualDataLinks={[proxyDataLink]}
      />,
    );

    expect(screen.getByText('Subgraphs')).toBeInTheDocument();
    expect(screen.getByText('Containers')).toBeInTheDocument();
    expect(screen.getByText('Control Links')).toBeInTheDocument();
    expect(screen.getByText('Virtual Data Links')).toBeInTheDocument();
    expect(screen.getByText('module-card:mod-2')).toBeInTheDocument();
    expect(screen.getByText('module-card:mod-1')).toBeInTheDocument();
  });

  it('does not import host stores', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src',
        'widgets',
        'properties-panel',
        'ui',
        'properties-panel.tsx',
      ),
      'utf8',
    );

    expect(source).not.toContain('useGraphDesignerStore');
    expect(source).not.toContain('useProjectStoreShallow');
  });
});
