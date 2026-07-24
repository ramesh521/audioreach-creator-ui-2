/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * The four session-local `EditSessionSlice` bookkeeping maps
 * (`subgraphProvenanceById`/`kvCasesById`/`pairLinksById`/`excludedLinks`)
 * have no source of truth to recompute from once the edit session that
 * populated them ends, so they must be cleared on every transition *into*
 * `'view'` — initial mount, post-Apply, and post-Discard alike — but never
 * on the `'view' → 'edit'` transition, which must not wipe state a session
 * in progress needs (core-edit-session-design.md's Mode State section).
 */
export function shouldResetSessionLocalMaps(mode: 'edit' | 'view'): boolean {
  return mode === 'view';
}
