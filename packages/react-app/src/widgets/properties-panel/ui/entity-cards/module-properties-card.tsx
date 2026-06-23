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
  type ModuleCardCallbacks,
  useModuleCardData,
} from '~widgets/properties-panel/model/use-module-card-data';
import {CollapsibleCard} from '~widgets/properties-panel/ui/shared/collapsible-card';

interface ModulePropertiesCardProps {
  callbacks: ModuleCardCallbacks;
  graphData: UsecaseGraphData;
  isEditing: boolean;
  moduleId: string;
  projectId: string;
}

export function ModulePropertiesCard({
  callbacks,
  graphData,
  isEditing,
  moduleId,
  projectId,
}: ModulePropertiesCardProps) {
  const vm = useModuleCardData(moduleId, graphData, projectId, callbacks);

  return (
    <CollapsibleCard title={vm.displayName}>
      <PropertyRow label="Alias">
        <TextInput
          aria-label="Alias"
          disabled={!isEditing}
          onValueChange={(value) => vm.updateAlias(value)}
          value={vm.alias}
        />
      </PropertyRow>
      <PropertyRow label="Module ID">
        <CopyableId value={toHexId(vm.moduleId)} />
      </PropertyRow>
      <PropertyRow label="Instance ID">
        <CopyableId value={toHexId(vm.moduleInstanceId)} />
      </PropertyRow>
      <PropertyRow label="Container ID">
        <TextInput
          aria-label="Container ID"
          disabled={!isEditing}
          onValueChange={(value) => vm.updateContainer(value)}
          value={vm.containerId}
        />
      </PropertyRow>
      <PropertyRow label="Max Input Ports">
        <TextInput
          aria-label="Max Input Ports"
          disabled={!isEditing}
          onValueChange={(value) =>
            vm.updatePortCount('maxInputPorts', Number(value))
          }
          value={String(vm.maxInputPorts)}
        />
      </PropertyRow>
      <PropertyRow label="Max Output Ports">
        <TextInput
          aria-label="Max Output Ports"
          disabled={!isEditing}
          onValueChange={(value) =>
            vm.updatePortCount('maxOutputPorts', Number(value))
          }
          value={String(vm.maxOutputPorts)}
        />
      </PropertyRow>
      <PropertyRow label="Max Control Ports">
        <TextInput
          aria-label="Max Control Ports"
          disabled={!isEditing}
          onValueChange={(value) =>
            vm.updatePortCount('maxControlPorts', Number(value))
          }
          value={String(vm.maxControlPorts)}
        />
      </PropertyRow>

      {vm.inputPorts.length > 0 && (
        <div className="mt-2">
          <p
            className="mb-1 text-xs font-medium"
            style={{color: 'var(--color-text-neutral-secondary)'}}
          >
            Input Ports
          </p>
          <div className="space-y-0.5">
            {vm.inputPorts.map((port) => (
              <div
                key={port.portId}
                className="grid grid-cols-4 gap-2 text-xs"
                style={{color: 'var(--color-text-neutral-secondary)'}}
              >
                <span>{port.portType}</span>
                <span>{toHexId(port.portId)}</span>
                <span>{port.portName}</span>
                <span>{port.isStatic ? 'Static' : 'Dynamic'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {vm.outputPorts.length > 0 && (
        <div className="mt-2">
          <p
            className="mb-1 text-xs font-medium"
            style={{color: 'var(--color-text-neutral-secondary)'}}
          >
            Output Ports
          </p>
          <div className="space-y-0.5">
            {vm.outputPorts.map((port) => (
              <div
                key={port.portId}
                className="grid grid-cols-4 gap-2 text-xs"
                style={{color: 'var(--color-text-neutral-secondary)'}}
              >
                <span>{port.portType}</span>
                <span>{toHexId(port.portId)}</span>
                <span>{port.portName}</span>
                <span>{port.isStatic ? 'Static' : 'Dynamic'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
}
