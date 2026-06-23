/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {ArrowRight, ChevronsRight, X} from 'lucide-react';

import {IconButton} from '@qualcomm-ui/react/button';

import type {ProxyDataLink} from '~entities/graph';
import type {UsecaseGraphData} from '~features/graph-designer/model/graph-data-slice';
import {toHexId} from '~shared/lib/format';
import {
  useVirtualDataLinkCardData,
  type VirtualDataLinkRow,
} from '~widgets/properties-panel/model/use-virtual-data-link-card-data';
import {CollapsibleCard} from '~widgets/properties-panel/ui/shared/collapsible-card';

interface VirtualDataLinkPropertiesCardProps {
  graphData: UsecaseGraphData;
  isEditing: boolean;
  linkId: string;
  onDeleteLink: (linkId: string) => void;
  onNavigateToNode: (nodeId: string) => void;
  virtualDataLinks: ProxyDataLink[];
}

export function VirtualDataLinkPropertiesCard({
  graphData,
  isEditing,
  linkId,
  onDeleteLink,
  onNavigateToNode,
  virtualDataLinks,
}: VirtualDataLinkPropertiesCardProps) {
  const vm = useVirtualDataLinkCardData(linkId, graphData, virtualDataLinks);

  const isStandard = vm.kind === 'standard';

  function renderRow(row: VirtualDataLinkRow, index: number) {
    const canNavigate = isStandard;
    const canDelete = isStandard && isEditing && row.connectionId !== '';

    return (
      <div
        key={row.connectionId || index}
        className="flex items-center gap-1 rounded border px-2 py-1"
        style={{borderColor: 'var(--color-border-neutral-02)'}}
      >
        {canNavigate && (
          <IconButton
            aria-label="Navigate to source"
            icon={<ChevronsRight className="h-4 w-4" />}
            onClick={() => onNavigateToNode(row.sourceNodeId)}
            variant="ghost"
          />
        )}

        <div className="flex min-w-0 flex-col">
          <span
            className="truncate text-sm font-semibold"
            style={{color: 'var(--color-text-neutral-primary)'}}
          >
            {row.sourceName}
          </span>
          <span
            className="font-mono text-xs"
            style={{color: 'var(--color-text-neutral-secondary)'}}
          >
            {row.sourceInstanceId} : {row.sourcePortId}
          </span>
        </div>

        <ArrowRight
          className="mx-1 h-4 w-4 shrink-0"
          style={{color: 'var(--color-text-neutral-secondary)'}}
        />

        <div className="min-w-0 flex-1 flex-col">
          <span
            className="truncate text-sm font-semibold"
            style={{color: 'var(--color-text-neutral-primary)'}}
          >
            {row.destName}
          </span>
          <span
            className="font-mono text-xs"
            style={{color: 'var(--color-text-neutral-secondary)'}}
          >
            {row.destInstanceId} : {row.destPortId}
          </span>
        </div>

        {canNavigate && (
          <IconButton
            aria-label="Navigate to destination"
            icon={<ChevronsRight className="h-4 w-4" />}
            onClick={() => onNavigateToNode(row.destNodeId)}
            variant="ghost"
          />
        )}

        {canDelete && (
          <IconButton
            aria-label="Delete link"
            icon={<X className="h-4 w-4" />}
            onClick={() => onDeleteLink(row.connectionId)}
            variant="ghost"
          />
        )}
      </div>
    );
  }

  return (
    <CollapsibleCard
      bodyClassName="flex flex-col gap-2 px-3 py-2"
      title="Virtual Data Link Info"
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{color: 'var(--color-text-neutral-secondary)'}}
      >
        Data Links
      </p>

      {vm.rows.length === 0 ? (
        <p
          className="text-xs"
          style={{color: 'var(--color-text-neutral-secondary)'}}
        >
          No connections
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {vm.rows.map((row, i) => renderRow(row, i))}
        </div>
      )}

      {vm.kind === 'mdf' && vm.mdfModules.length > 0 && (
        <div className="flex flex-col gap-1">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{color: 'var(--color-text-neutral-secondary)'}}
          >
            Modules
          </p>
          {vm.mdfModules.map((mod) => (
            <div key={mod.moduleInstanceId} className="flex items-center gap-2">
              <span
                className="min-w-0 flex-1 truncate text-sm"
                style={{color: 'var(--color-text-neutral-primary)'}}
              >
                {mod.name}
              </span>
              <span
                className="font-mono text-xs"
                style={{color: 'var(--color-text-neutral-secondary)'}}
              >
                {toHexId(mod.moduleId)}
              </span>
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
}
