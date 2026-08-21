/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  createDataLink,
  createDataLinkWithSubsystems,
  deleteDataLink,
} from '~entities/usecases';
import type {ComponentCollectionDto} from '~entities/usecases/model/usecase-component.dto';
import {showToast} from '~shared/controls/global-toaster';

import {withMutationLock} from '../model/edit-session-slice';
import type {DeletedIdsCollection} from '../model/graph-data-slice';
import type {GraphDesignerStore} from '../model/graph-designer-store';

// This file inlines its own copy rather than importing across operations
// files — every operations file keeps its own.
const EMPTY_COLLECTION: ComponentCollectionDto = {
  controlLinks: [],
  dataLinks: [],
  spfModules: [],
};

const EMPTY_DELETED_COLLECTION: DeletedIdsCollection = {
  controlLinks: [],
  dataLinks: [],
  spfModules: [],
};

export function createLinkOperations(projectId: string) {
  return {connectPorts, deleteLink};

  function isSubsystemNode(
    get: () => GraphDesignerStore,
    nodeId: string,
  ): boolean {
    return nodeId in (get().graphData?.subsystems ?? {});
  }

  async function connectPortsInner(
    get: () => GraphDesignerStore,
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string,
  ): Promise<boolean> {
    const useSubsystemVariant =
      isSubsystemNode(get, sourceNodeId) || isSubsystemNode(get, targetNodeId);
    const create = useSubsystemVariant
      ? createDataLinkWithSubsystems
      : createDataLink;

    const result = await create(projectId, {
      destinationNodeSystemId: targetNodeId,
      destinationPortSystemId: targetPortId,
      sourceNodeSystemId: sourceNodeId,
      sourcePortSystemId: sourcePortId,
    });

    if (!result.success || !result.data) {
      showToast(result.message ?? 'Failed to create connection', 'danger');
      return false;
    }

    await get().applyComponentCollection({
      added: result.data,
      deleted: EMPTY_DELETED_COLLECTION,
      updated: EMPTY_COLLECTION,
    });
    return true;
  }

  async function connectPorts(
    get: () => GraphDesignerStore,
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string,
  ): Promise<boolean> {
    return withMutationLock(get, () =>
      connectPortsInner(
        get,
        sourceNodeId,
        sourcePortId,
        targetNodeId,
        targetPortId,
      ),
    );
  }

  async function deleteLinkInner(
    get: () => GraphDesignerStore,
    connectionId: string,
  ): Promise<boolean> {
    const result = await deleteDataLink(projectId, connectionId);

    if (!result.success || !result.data) {
      showToast(result.message ?? 'Failed to delete connection', 'danger');
      return false;
    }

    await get().applyComponentCollection({
      added: EMPTY_COLLECTION,
      deleted: {...EMPTY_DELETED_COLLECTION, dataLinks: [connectionId]},
      updated: EMPTY_COLLECTION,
    });
    return true;
  }

  async function deleteLink(
    get: () => GraphDesignerStore,
    connectionId: string,
  ): Promise<boolean> {
    return withMutationLock(get, () => deleteLinkInner(get, connectionId));
  }
}
