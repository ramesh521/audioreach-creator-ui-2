/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {type ReactNode, useState} from 'react';

import {ChevronDown, ChevronRight} from 'lucide-react';

import {IconButton} from '@qualcomm-ui/react/button';

export interface CollapsibleCardProps {
  bodyClassName?: string;
  children: ReactNode;
  headerExtra?: ReactNode;
  title: string;
}

export function CollapsibleCard({
  bodyClassName = 'space-y-1 px-3 py-2',
  children,
  headerExtra,
  title,
}: CollapsibleCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className="rounded border"
      style={{borderColor: 'var(--color-border-neutral-02)'}}
    >
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{
          backgroundColor: 'var(--color-surface-secondary)',
          borderColor: 'var(--color-border-neutral-02)',
        }}
      >
        <IconButton
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          icon={
            isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )
          }
          onClick={() => setIsCollapsed((c) => !c)}
          variant="ghost"
        />
        <span
          className="text-sm font-medium"
          style={{color: 'var(--color-text-neutral-primary)'}}
        >
          {title}
        </span>
        {headerExtra}
      </div>
      {!isCollapsed && <div className={bodyClassName}>{children}</div>}
    </div>
  );
}
