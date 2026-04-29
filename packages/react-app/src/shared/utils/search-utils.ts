/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {ConvertStringToNumber} from './converter-utils';

/**
 * Search items by matching query against all fields with  matching:
 * - Number fields: Exact match only (supports both decimal and hex queries)
 * - String fields starting with '0x': Try to convert to number
 *   - If conversion succeeds: Exact match as number
 *   - If conversion fails: Partial match as string
 * - Regular string fields: Partial match

 * @param items - Array of items to search
 * @param query - Search query string
 * @returns Filtered array of items matching the search query
 */
export function searchItems<T>(items: T[], query: string): T[] {
  if (!query.trim()) {
    return items;
  }

  const searchLower = query.toLowerCase().trim();
  const queryAsNumber = ConvertStringToNumber(query);

  function matchesQuery(obj: Record<string, unknown>): boolean {
    for (const key in obj) {
      const val = obj[key];
      if (val == null) {
        continue;
      }

      // NUMBER FIELD: Exact match (query can be decimal or hex)
      if (
        typeof val === 'number' &&
        queryAsNumber !== null &&
        val === queryAsNumber
      ) {
        return true;
      } else if (typeof val === 'string') {
        // Try to convert string to number (if it starts with 0x)
        const valueAsNumber = ConvertStringToNumber(val);

        if (
          valueAsNumber !== null &&
          queryAsNumber !== null &&
          valueAsNumber === queryAsNumber
        ) {
          // Successfully converted to number - use EXACT match
          return true;
        } else {
          // Not a valid number string - use PARTIAL match
          if (val.toLowerCase().includes(searchLower)) {
            return true;
          }
        }
      } else if (typeof val === 'object' && !Array.isArray(val)) {
        // Recursively check nested objects
        if (matchesQuery(val as Record<string, unknown>)) {
          return true;
        }
      }
    }
    return false;
  }

  return items.filter((item) => matchesQuery(item as Record<string, unknown>));
}
