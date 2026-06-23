/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {ReactNode} from 'react';

export interface PropertyRowProps {
  children: ReactNode;
  label: string;
  renderAction?: () => ReactNode;
}

export function PropertyRow({children, label, renderAction}: PropertyRowProps) {
  return (
    <div className="flex items-center gap-2 py-1">
      {renderAction?.()}
      <span
        className="w-1/2 shrink-0 text-sm"
        style={{color: 'var(--color-text-neutral-secondary)'}}
      >
        {label}
      </span>
      <div className="w-1/2 min-w-0">{children}</div>
    </div>
  );
}
