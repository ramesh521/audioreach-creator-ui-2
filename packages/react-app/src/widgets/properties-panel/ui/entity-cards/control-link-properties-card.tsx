/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {Button} from '@qualcomm-ui/react/button';

import type {ProxyControlLink} from '~entities/graph';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {CopyableId} from '~shared/controls/copyable-id';
import {PropertyRow} from '~shared/controls/property-row';
import {toHexId} from '~shared/lib/format';
import {
  type ControlLinkCardCallbacks,
  useControlLinkCardData,
} from '~widgets/properties-panel/model/use-control-link-card-data';
import {CollapsibleCard} from '~widgets/properties-panel/ui/shared/collapsible-card';

interface ControlLinkPropertiesCardProps {
  callbacks: ControlLinkCardCallbacks;
  graphData: UsecaseGraphData;
  isEditing: boolean;
  isVirtual?: boolean;
  linkId: string;
  projectId: string;
  virtualControlLinks?: ProxyControlLink[];
}

export function ControlLinkPropertiesCard({
  callbacks,
  graphData,
  isEditing,
  isVirtual = false,
  linkId,
  projectId,
  virtualControlLinks,
}: ControlLinkPropertiesCardProps) {
  const vm = useControlLinkCardData(
    linkId,
    graphData,
    projectId,
    callbacks,
    virtualControlLinks,
  );

  return (
    <CollapsibleCard
      title={isVirtual ? 'Virtual Control Link' : 'Control Link'}
    >
      {vm.error && (
        <p
          className="text-xs"
          style={{color: 'var(--color-text-support-danger)'}}
        >
          {vm.error}
        </p>
      )}
      <PropertyRow label="Source">
        <span
          className="text-sm"
          style={{color: 'var(--color-text-neutral-primary)'}}
        >
          {vm.sourceComponentInfo}
        </span>
      </PropertyRow>
      <PropertyRow label="Source Port">
        <span
          className="text-sm"
          style={{color: 'var(--color-text-neutral-primary)'}}
        >
          {vm.sourcePortId}
        </span>
      </PropertyRow>
      <PropertyRow label="Destination">
        <span
          className="text-sm"
          style={{color: 'var(--color-text-neutral-primary)'}}
        >
          {vm.destComponentInfo}
        </span>
      </PropertyRow>
      <PropertyRow label="Destination Port">
        <span
          className="text-sm"
          style={{color: 'var(--color-text-neutral-primary)'}}
        >
          {vm.destPortId}
        </span>
      </PropertyRow>

      {vm.isLoading && (
        <p
          className="text-xs"
          style={{color: 'var(--color-text-neutral-secondary)'}}
        >
          Loading properties…
        </p>
      )}

      {!vm.isLoading && vm.linkProperties && (
        <>
          <PropertyRow label="Allocated Intents">
            <CopyableId
              value={toHexId(String(vm.linkProperties.AllocatedIntents.propId))}
            />
          </PropertyRow>
          {vm.linkProperties.SupportedIntents && (
            <PropertyRow label="Supported Intents">
              <CopyableId
                value={toHexId(
                  String(vm.linkProperties.SupportedIntents.propId),
                )}
              />
            </PropertyRow>
          )}
          <PropertyRow label="Heap ID">
            <CopyableId
              value={toHexId(String(vm.linkProperties.HeapId.propId))}
            />
          </PropertyRow>
        </>
      )}

      {isEditing && (
        <div className="mt-2">
          <Button emphasis="danger" onClick={() => vm.onDeleteLink(linkId)}>
            Delete Link
          </Button>
        </div>
      )}
    </CollapsibleCard>
  );
}
