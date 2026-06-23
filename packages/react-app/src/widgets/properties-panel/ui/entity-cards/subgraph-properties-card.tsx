/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {TextInput} from '@qualcomm-ui/react/text-input';

import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {CopyableId} from '~shared/controls/copyable-id';
import {PropertyRow} from '~shared/controls/property-row';
import {toHexId} from '~shared/lib/format';
import {
  type SubgraphCardCallbacks,
  useSubgraphCardData,
} from '~widgets/properties-panel/model/use-subgraph-card-data';
import {CollapsibleCard} from '~widgets/properties-panel/ui/shared/collapsible-card';
import {SchemaPropertyRenderer} from '~widgets/properties-panel/ui/shared/schema-property-renderer';

interface SubgraphPropertiesCardProps {
  callbacks: SubgraphCardCallbacks;
  graphData: UsecaseGraphData;
  isEditing: boolean;
  projectId: string;
  subgraphId: string;
}

export function SubgraphPropertiesCard({
  callbacks,
  graphData,
  isEditing,
  projectId,
  subgraphId,
}: SubgraphPropertiesCardProps) {
  const vm = useSubgraphCardData(subgraphId, graphData, projectId, callbacks);

  return (
    <CollapsibleCard
      headerExtra={<CopyableId value={toHexId(vm.subgraphId)} />}
      title="Subgraph:"
    >
      {vm.error && (
        <p
          className="text-xs"
          style={{color: 'var(--color-text-support-danger)'}}
        >
          {vm.error}
        </p>
      )}
      <PropertyRow label="Name">
        <TextInput
          aria-label="Name"
          disabled={!isEditing}
          onValueChange={(value) => vm.updateName(value)}
          value={vm.name}
        />
      </PropertyRow>
      {vm.isLoading ? (
        <p
          className="text-xs"
          style={{color: 'var(--color-text-neutral-secondary)'}}
        >
          Loading properties…
        </p>
      ) : (
        <SchemaPropertyRenderer
          isEditing={isEditing}
          onPropertyChange={vm.updateProperty}
          properties={vm.properties}
        />
      )}
    </CollapsibleCard>
  );
}
