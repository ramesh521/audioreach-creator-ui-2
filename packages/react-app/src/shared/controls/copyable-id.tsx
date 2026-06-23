/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {Copy} from 'lucide-react';

import {IconButton} from '@qualcomm-ui/react/button';

export interface CopyableIdProps {
  className?: string;
  value: string;
}

export function CopyableId({className, value}: CopyableIdProps) {
  function handleCopy() {
    void navigator.clipboard.writeText(value);
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <span
        className="font-mono text-sm"
        style={{color: 'var(--color-text-neutral-secondary)'}}
      >
        {value}
      </span>
      <IconButton
        aria-label="Copy to clipboard"
        emphasis="neutral"
        icon={Copy}
        onClick={handleCopy}
      />
    </span>
  );
}
