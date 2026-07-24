/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import type {
  ControlLinkDto,
  DataLinkDto,
  SpfModuleDto,
  SubsystemDto,
} from '~entities/usecases/model/usecase-component.dto';
import {withMutationLock} from '~features/graph-designer/model/edit-session-slice';
import {createGraphDesignerStore} from '~features/graph-designer/model/graph-designer-store';
import {useGlobalStore} from '~shared/store/global-store';

function makeSpfModuleDto(overrides: Partial<SpfModuleDto> = {}): SpfModuleDto {
  return {
    alias: '',
    changeInfo: {changeType: 'CREATE'},
    containerId: 10,
    controlPorts: [],
    dataPorts: [],
    heapId: 0,
    id: 1,
    maxControlPortsSupported: 0,
    maxInputPortsSupported: 0,
    maxOutputPortsSupported: 0,
    moduleId: 200,
    name: 'Module',
    relatedEndPointLinks: [],
    subgraphId: 1,
    systemId: 'mod-placeholder',
    ...overrides,
  };
}

function makeDataLinkDto(overrides: Partial<DataLinkDto> = {}): DataLinkDto {
  return {
    changeInfo: {changeType: 'CREATE'},
    connectionType: 'MODULE_MODULE',
    destinationId: 2,
    destinationPortId: 20,
    isDangling: false,
    name: 'link',
    relatedEndPointLinks: [],
    sourceId: 1,
    sourcePortId: 10,
    systemId: 'link-placeholder',
    ...overrides,
  };
}

function makeSubsystemDto(overrides: Partial<SubsystemDto> = {}): SubsystemDto {
  return {
    changeInfo: {changeType: 'DELETE'},
    controlPorts: [],
    dataPorts: [],
    filteredKeys: [],
    id: 50,
    name: 'Subsystem',
    relatedEndPointLinks: [],
    systemId: 'ss-placeholder',
    ...overrides,
  };
}

describe('createGraphDesignerStore — EditSessionSlice composition', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('exposes EditSessionSlice state and actions on the composed store', () => {
    const store = createGraphDesignerStore('tab-1', 'proj-gds-1');

    expect(store.getState().mode).toBe('view');
    expect(store.getState().isMutating).toBe(false);

    const acquired = store.getState().enterEditMode();

    expect(acquired).toBe(true);
    expect(store.getState().mode).toBe('edit');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-gds-1'],
    ).toBe('usecase-edit');

    store.getState().exitEditMode();

    expect(store.getState().mode).toBe('view');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-gds-1'],
    ).toBeUndefined();
  });

  it('scopes the exclusive lock to the projectId passed at creation, not a flat flag', () => {
    const storeA = createGraphDesignerStore('tab-a', 'proj-gds-2');
    const storeB = createGraphDesignerStore('tab-b', 'proj-gds-3');

    expect(storeA.getState().enterEditMode()).toBe(true);
    expect(storeB.getState().enterEditMode()).toBe(true);
    expect(storeA.getState().mode).toBe('edit');
    expect(storeB.getState().mode).toBe('edit');
  });
});

describe('createGraphDesignerStore — exclusive lock across two tabs on the same project', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('blocks a second tab on the same project while the first tab holds edit mode, then allows it once the first tab exits', () => {
    const tabA = createGraphDesignerStore('tab-a', 'proj-shared-1');
    const tabB = createGraphDesignerStore('tab-b', 'proj-shared-1');

    const firstTabAcquired = tabA.getState().enterEditMode();
    const secondTabAcquired = tabB.getState().enterEditMode();

    expect(firstTabAcquired).toBe(true);
    expect(secondTabAcquired).toBe(false);
    expect(tabA.getState().mode).toBe('edit');
    expect(tabB.getState().mode).toBe('view');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-shared-1'],
    ).toBe('usecase-edit');

    tabA.getState().exitEditMode();
    const secondTabAcquiredAfterExit = tabB.getState().enterEditMode();

    expect(secondTabAcquiredAfterExit).toBe(true);
    expect(tabB.getState().mode).toBe('edit');
    expect(tabA.getState().mode).toBe('view');
  });
});

describe('createGraphDesignerStore — full edit-session round-trip through a mixed mutation response', () => {
  afterEach(() => {
    useGlobalStore.setState({activeExclusiveModeByProject: {}});
  });

  it('reconciles a mixed create/delete response spanning modules, links, and subsystems inside one edit session', async () => {
    const store = createGraphDesignerStore('tab-e2e', 'proj-e2e-1');
    store.setState({
      excludedLinks: [
        {
          connectionId: 'link-old',
          connectionType: 'data',
          fromModuleId: 'mod-A',
          fromPortId: '11',
          toModuleId: 'ss-1',
          toPortId: '90',
        },
      ],
      graphData: {
        connections: [
          {
            connectionId: 'link-old',
            connectionType: 'data',
            fromModuleId: 'mod-A',
            fromPortId: '11',
            toModuleId: 'ss-1',
            toPortId: '90',
          },
        ],
        containers: {},
        moduleInstances: {
          'mod-A': {
            containerId: 'c1',
            displayName: 'Mod A',
            id: 1,
            inputPorts: [],
            moduleId: '100',
            moduleInstanceId: 'mod-A',
            moduleName: 'Mod A',
            moduleType: 'SOURCE',
            outputPorts: [
              {
                direction: 'output',
                id: 11,
                isStatic: false,
                portId: '11',
                portName: 'out1',
                portType: 'data',
                totalLinksAtPort: 1,
              },
              {
                direction: 'output',
                id: 12,
                isStatic: false,
                portId: '12',
                portName: 'out2',
                portType: 'data',
                totalLinksAtPort: 0,
              },
            ],
            position: {x: 0, y: 0},
            subgraphId: 'sg-1',
          },
        },
        selectedUsecases: [],
        subgraphs: {},
        subsystems: {
          'ss-1': {
            controlPorts: [],
            dataPorts: [],
            id: 50,
            subgraphs: ['sg-1'],
            subsystemId: 'ss-1',
            subsystemName: 'Subsystem 1',
          },
        },
      },
      moduleList: [
        {
          builtIn: false,
          category: '',
          description: '',
          dspType: '',
          inputPorts: [],
          moduleId: '300',
          moduleName: 'Mod B',
          moduleType: 'SINK',
          outputPorts: [],
        },
      ],
      pairLinksById: {
        'link-old': {
          connectionType: 'data' as const,
          fromModuleId: 'mod-A',
          fromPortId: '11',
          id: 'link-old',
          sourceSubgraphId: 'sg-1',
          targetSubgraphId: 'sg-1',
          toModuleId: 'ss-1',
          toPortId: '90',
        },
      },
    });

    const entered = store.getState().enterEditMode();
    expect(entered).toBe(true);
    expect(store.getState().mode).toBe('edit');

    const empty = {
      controlLinks: [] as ControlLinkDto[],
      dataLinks: [] as DataLinkDto[],
      spfModules: [] as SpfModuleDto[],
    };

    await withMutationLock(store.getState, async () => {
      store.getState().applyComponentCollection({
        added: {
          ...empty,
          dataLinks: [
            makeDataLinkDto({
              destinationId: 2,
              destinationPortId: 21,
              sourceId: 1,
              sourcePortId: 12,
              systemId: 'link-new',
            }),
          ],
          spfModules: [
            makeSpfModuleDto({
              containerId: 20,
              dataPorts: [
                {
                  id: 21,
                  name: 'in1',
                  portIoType: 'Input',
                  portType: 'Dynamic',
                  systemId: '21',
                  totalLinksAtPort: 0,
                } as never,
              ],
              id: 2,
              moduleId: 300,
              name: 'Mod B',
              subgraphId: 2,
              systemId: 'mod-B',
            }),
          ],
        },
        deleted: {
          ...empty,
          dataLinks: [
            makeDataLinkDto({
              destinationId: 50,
              destinationPortId: 90,
              sourceId: 1,
              sourcePortId: 11,
              systemId: 'link-old',
            }),
          ],
          subsystems: [makeSubsystemDto({id: 50, systemId: 'ss-1'})],
        },
        updated: empty,
      });
    });

    expect(store.getState().isMutating).toBe(false);

    const state = store.getState();
    const graphData = state.graphData!;

    // Pure-create half: the new module and its link exist.
    expect(graphData.moduleInstances['mod-B']).toBeDefined();
    expect(graphData.moduleInstances['mod-B'].moduleType).toBe('SINK');
    expect(
      graphData.connections.find((c) => c.connectionId === 'link-new'),
    ).toEqual({
      connectionId: 'link-new',
      connectionType: 'data',
      fromModuleId: 'mod-A',
      fromPortId: '12',
      toModuleId: 'mod-B',
      toPortId: '21',
    });

    // Pure-delete half: the old link and the subsystem it terminated at are gone.
    expect(
      graphData.connections.find((c) => c.connectionId === 'link-old'),
    ).toBeUndefined();
    expect(graphData.subsystems['ss-1']).toBeUndefined();

    // recomputeContainersAndSubgraphs re-derived containers/subgraphs from
    // the surviving + newly-added modules together.
    expect(Object.keys(graphData.containers).sort()).toEqual(['20', 'c1']);
    expect(Object.keys(graphData.subgraphs).sort()).toEqual(['2', 'sg-1']);

    // pruneDeletedLinkBookkeeping dropped the deleted link's bookkeeping.
    expect(state.pairLinksById['link-old']).toBeUndefined();
    expect(state.excludedLinks).toEqual([]);

    // adjustSurvivingPortCounts moved both endpoints of the new link up and
    // the surviving endpoint of the deleted link down; the deleted link's
    // other endpoint (a subsystem, not a module) was silently skipped.
    const modA = graphData.moduleInstances['mod-A'];
    expect(
      modA.outputPorts.find((p) => p.portId === '11')?.totalLinksAtPort,
    ).toBe(0);
    expect(
      modA.outputPorts.find((p) => p.portId === '12')?.totalLinksAtPort,
    ).toBe(1);
    expect(
      graphData.moduleInstances['mod-B'].inputPorts[0].totalLinksAtPort,
    ).toBe(1);

    store.getState().exitEditMode();

    expect(store.getState().mode).toBe('view');
    expect(
      useGlobalStore.getState().activeExclusiveModeByProject['proj-e2e-1'],
    ).toBeUndefined();
  });
});
