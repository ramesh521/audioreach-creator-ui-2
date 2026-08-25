/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');
jest.mock('~entities/control-links/api/fetch-control-link-properties');

import {render, screen, waitFor} from '@testing-library/react';

import {fetchControlLinkProperties} from '~entities/control-links/api/fetch-control-link-properties';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {ControlLinkPropertiesCard} from '~widgets/properties-panel/ui/entity-cards/control-link-properties-card';

const mockFetch = jest.mocked(fetchControlLinkProperties);

const graphData: UsecaseGraphData = {
  connections: [
    {
      connectionId: 'cl-1',
      connectionType: 'control',
      destinationId: 'm-2',
      destinationPortId: '2',
      sourceId: 'm-1',
      sourcePortId: '1',
    },
  ],
  containers: {},
  moduleInstances: {
    'm-1': {
      containerId: 'c-1',
      displayName: 'Source Module',
      inputPorts: [],
      moduleId: '100',
      moduleInstanceId: 'm-1',
      moduleName: 'Source Module',
      moduleType: 'audio',
      outputPorts: [],
      position: {x: 0, y: 0},
      subgraphId: 'sg-1',
    },
    'm-2': {
      containerId: 'c-1',
      displayName: 'Destination Module',
      inputPorts: [],
      moduleId: '200',
      moduleInstanceId: 'm-2',
      moduleName: 'Destination Module',
      moduleType: 'audio',
      outputPorts: [],
      position: {x: 0, y: 0},
      subgraphId: 'sg-1',
    },
  },
  selectedUsecases: [],
  subgraphs: {},
  subsystems: {},
};

describe('ControlLinkPropertiesCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      data: {
        AllocatedIntents: {propId: 32},
        HeapId: {propId: 48},
        SupportedIntents: {propId: 64},
      },
      success: true,
    });
  });

  it('renders fetched intents and heap fields', async () => {
    render(
      <ControlLinkPropertiesCard
        callbacks={{onDeleteLink: jest.fn()}}
        graphData={graphData}
        isEditing={false}
        linkId="cl-1"
        projectId="proj-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Allocated Intents')).toBeInTheDocument();
    });

    expect(screen.getByText('Supported Intents')).toBeInTheDocument();
    expect(screen.getByText('Heap ID')).toBeInTheDocument();
    expect(screen.getByText('0x20')).toBeInTheDocument();
    expect(screen.getByText('0x30')).toBeInTheDocument();
    expect(screen.getByText('0x40')).toBeInTheDocument();
  });
});
