/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Formats a numeric or decimal-string ID as a `0x`-prefixed uppercase hex
 * string. IDs already in hex form (`0x…`) are returned unchanged. Non-numeric
 * strings are returned as-is.
 */
export function toHexId(id: string): string {
  if (!id) {
    return id;
  }
  if (id.startsWith('0x') || id.startsWith('0X')) {
    return id;
  }
  const n = Number(id);
  if (Number.isFinite(n) && Number.isInteger(n) && String(n) === id.trim()) {
    return `0x${n.toString(16).toUpperCase()}`;
  }
  return id;
}
