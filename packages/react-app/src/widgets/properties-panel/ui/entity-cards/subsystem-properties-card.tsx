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
  type SubsystemCardCallbacks,
  useSubsystemCardData,
} from '~widgets/properties-panel/model/use-subsystem-card-data';
import {CollapsibleCard} from '~widgets/properties-panel/ui/shared/collapsible-card';

interface SubsystemPropertiesCardProps {
  callbacks: SubsystemCardCallbacks;
  graphData: UsecaseGraphData;
  isEditing: boolean;
  projectId: string;
  subsystemId: string;
}

export function SubsystemPropertiesCard({
  callbacks,
  graphData,
  isEditing,
  projectId,
  subsystemId,
}: SubsystemPropertiesCardProps) {
  const vm = useSubsystemCardData(subsystemId, graphData, projectId, callbacks);

  return (
    <CollapsibleCard title="Subsystem:">
      <PropertyRow label="Name">
        <TextInput
          aria-label="Name"
          disabled={!isEditing}
          onValueChange={(value) => vm.updateName(value)}
          value={vm.subsystemName}
        />
      </PropertyRow>
      <PropertyRow label="Subsystem ID">
        <CopyableId value={toHexId(vm.subsystemId)} />
      </PropertyRow>
    </CollapsibleCard>
  );
}
