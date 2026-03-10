/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {Search} from 'lucide-react';

import {TextInput} from '@qualcomm-ui/react/text-input';

interface ArcSearchBarProps {
  /** A callback function thats triggered on every keystroke */
  readonly onSearchChange: (value: string) => void;
  readonly placeholder?: string;
  readonly searchTerm: string;
}

export default function ArcSearchBar({
  onSearchChange,
  placeholder,
  searchTerm,
}: ArcSearchBarProps) {
  return (
    <TextInput
      aria-label={placeholder || 'Search'}
      className="w-full border-transparent bg-transparent text-base placeholder-gray-400 focus:outline-none"
      onValueChange={onSearchChange}
      placeholder={placeholder}
      startIcon={Search}
      value={searchTerm}
    />
  );
}
