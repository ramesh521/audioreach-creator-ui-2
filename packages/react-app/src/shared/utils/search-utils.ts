/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {ConvertStringToNumber} from './converter-utils';

/**
 * Generic search function for items with name and ID
 * Supports partial name matching and exact ID matching
 *
 * @param items - Array of items to search
 * @param query - Search query string
 * @param idField - Name of the ID field (e.g., 'moduleId' or 'subgraphId')
 * @returns Filtered array of items matching the search query
 */
export function searchByNameAndId<
  T extends {[key: string]: any; name?: string},
>(items: T[], query: string, idField: keyof T): T[] {
  if (!query) {
    return items;
  }

  const searchLower = query.toLowerCase();

  return items.filter((item) => {
    // Search by name (partial matching)
    const name = (item.name || '').toLowerCase();
    if (name.includes(searchLower)) {
      return true;
    }

    // Search by ID (exact match only)
    const id = item[idField] as number;
    const queryAsNumber = ConvertStringToNumber(query);
    if (queryAsNumber !== null && id === queryAsNumber) {
      return true;
    }

    return false;
  });
}
