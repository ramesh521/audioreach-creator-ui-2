/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {Button} from '@qualcomm-ui/react/button';

import type {ProxyControlLink} from '~entities/graph';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {PropertyRow} from '~shared/controls/property-row';
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

      {/* TODO: Render intents table and heap select once ControlLinkPropertiesDto
          shape is confirmed with the backend team (currently only carries propId). */}

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
