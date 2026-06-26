/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

// Re-export DTO types for UI convenience
export type {
  FilteredKV,
  KeyValueInfo as KeyValue,
  RelatedEndPointLink,
  UsecaseCategory,
  UsecaseIdentifier as Usecase,
} from '~entities/usecases';

export type SearchSetting =
  | 'Default Search'
  | 'Match Value(s)'
  | 'Match Usecase';

export interface SearchKeyword {
  description: string;
  name: string;
}
