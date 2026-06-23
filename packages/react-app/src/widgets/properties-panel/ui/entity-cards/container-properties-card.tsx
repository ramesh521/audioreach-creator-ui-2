/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {CopyableId} from '~shared/controls/copyable-id';
import {PropertyRow} from '~shared/controls/property-row';
import {toHexId} from '~shared/lib/format';
import {
  type ContainerCardCallbacks,
  useContainerCardData,
} from '~widgets/properties-panel/model/use-container-card-data';
import {CollapsibleCard} from '~widgets/properties-panel/ui/shared/collapsible-card';
import {SchemaPropertyRenderer} from '~widgets/properties-panel/ui/shared/schema-property-renderer';

interface ContainerPropertiesCardProps {
  callbacks: ContainerCardCallbacks;
  containerId: string;
  graphData: UsecaseGraphData;
  isEditing: boolean;
  projectId: string;
}

export function ContainerPropertiesCard({
  callbacks,
  containerId,
  graphData,
  isEditing,
  projectId,
}: ContainerPropertiesCardProps) {
  const vm = useContainerCardData(containerId, graphData, projectId, callbacks);

  return (
    <CollapsibleCard
      headerExtra={<CopyableId value={toHexId(vm.containerId)} />}
      title="Container:"
    >
      {vm.error && (
        <p
          className="text-xs"
          style={{color: 'var(--color-text-support-danger)'}}
        >
          {vm.error}
        </p>
      )}
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
          onPropertyChange={vm.updateContainerProperty}
          properties={vm.containerProperties}
        />
      )}
      {Object.keys(vm.moduleProperties).length > 0 && (
        <div className="mt-2 space-y-1">
          <p
            className="text-xs font-medium"
            style={{color: 'var(--color-text-neutral-secondary)'}}
          >
            Module Properties
          </p>
          {Object.entries(vm.moduleProperties).map(([moduleId, props]) => (
            <PropertyRow
              key={moduleId}
              label={
                graphData.moduleInstances[moduleId]?.displayName ?? moduleId
              }
            >
              <SchemaPropertyRenderer
                isEditing={isEditing}
                onPropertyChange={(propId, elementName, value) =>
                  vm.updateModuleHeap(moduleId, propId, elementName, value)
                }
                properties={props}
              />
            </PropertyRow>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
}
