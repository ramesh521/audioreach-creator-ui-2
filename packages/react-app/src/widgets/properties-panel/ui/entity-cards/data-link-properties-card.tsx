/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {PropertyRow} from '~shared/controls/property-row';
import {useDataLinkCardData} from '~widgets/properties-panel/model/use-data-link-card-data';
import {CollapsibleCard} from '~widgets/properties-panel/ui/shared/collapsible-card';

interface DataLinkPropertiesCardProps {
  graphData: UsecaseGraphData;
  linkId: string;
}

export function DataLinkPropertiesCard({
  graphData,
  linkId,
}: DataLinkPropertiesCardProps) {
  const vm = useDataLinkCardData(linkId, graphData);

  return (
    <CollapsibleCard title="Data Link">
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
    </CollapsibleCard>
  );
}
