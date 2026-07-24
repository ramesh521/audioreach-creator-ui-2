/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {StoreApi} from 'zustand';

import type {KeyValueInfo} from '~entities/usecases';
import {logger} from '~shared/lib/logger';
import {useGlobalStore} from '~shared/store/global-store';

import type {Connection} from './graph-data-slice';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Where a subgraph currently on canvas came from this edit session —
 *  stamped once per subgraph, consulted by `recomputeContainersAndSubgraphs`
 *  on every recompute (node-operations-design.md). */
export type SubgraphProvenance =
  | 'newly-created'
  | 'palette-placed'
  | 'pre-loaded';

/** One selectable KV *case* a subgraph supports — a whole Key+Value
 *  combination offered as a unit, not an individually toggleable pair
 *  (kv-key-configuration-design.md's KV Assignment section). */
export interface KvCase {
  id: string; // this case's own SGKV systemId if supported; a client-generated placeholder if custom (never sent to the backend as a systemId)
  keyValuePairs: KeyValueInfo[]; // mirrors KeyValuePairsInfo.keyValueCollection — {keyInfo, valueInfo}[]
  selected: boolean;
  source: 'custom' | 'supported'; // from SGKV vs. user-added (REQ-041/043)
}

/** node-operations-design.md's own working assumption for
 *  `getSubgraphPairs`'s element shape — the real API defines
 *  `SubgraphPairDto` as an empty placeholder object with no fields yet;
 *  confirm against the real contract once the backend team publishes it. */
export interface SubgraphPairDto {
  connectionType: 'control' | 'data';
  fromModuleId: string;
  fromPortId: string;
  id: string; // link ID — same as the resulting Connection's connectionId, and the key used in pairLinksById
  sourceSubgraphId: string;
  targetSubgraphId: string;
  toModuleId: string;
  toPortId: string;
}

export interface EditSessionSlice {
  beginMutation: () => void;
  endMutation: () => void;
  /** Returns `false` if the cross-project exclusive lock is unavailable —
   *  `mode` stays `'view'` in that case. */
  enterEditMode: () => boolean;
  excludedLinks: Connection[];
  exitEditMode: () => void;
  /** Single serial mutation lock, REQ-065 — gates all canvas interaction
   *  for the duration of any one backend call. */
  isMutating: boolean;
  kvCasesById: Record<string, KvCase[]>;
  mode: 'view' | 'edit';
  pairLinksById: Record<string, SubgraphPairDto>;
  resetSessionLocalMaps: () => void;
  subgraphProvenanceById: Record<string, SubgraphProvenance>;
  /** Fixed for the lifetime of the edit session, set in `enterEditMode()`. */
  usesSubsystemVariant: boolean;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

/**
 * Creates the edit-session slice for composing into the Graph Designer tab
 * store. Holds session bookkeeping only (mode, exclusive lock, the single
 * serial mutation flag) — no graph data of its own.
 *
 * @param set - Zustand set function bound to the parent store state.
 * @param projectId - Project identifier this session's exclusive lock is scoped to.
 */
export function createEditSessionSlice<S extends EditSessionSlice>(
  set: StoreApi<S>['setState'],
  projectId: string,
): EditSessionSlice {
  return {
    beginMutation: () => {
      logger.debug('editSessionSlice: beginMutation', {
        action: 'beginMutation',
        component: 'editSessionSlice',
      });
      set({isMutating: true} as Partial<S>);
    },

    endMutation: () => {
      logger.debug('editSessionSlice: endMutation', {
        action: 'endMutation',
        component: 'editSessionSlice',
      });
      set({isMutating: false} as Partial<S>);
    },

    enterEditMode: () => {
      const acquired = useGlobalStore
        .getState()
        .setActiveExclusiveMode(projectId, 'usecase-edit');

      if (!acquired) {
        logger.debug(
          'editSessionSlice: enterEditMode rejected — lock unavailable',
          {
            action: 'enterEditMode',
            component: 'editSessionSlice',
            projectId,
          },
        );
        return false;
      }

      set({
        mode: 'edit',
        // The raw/subsystem display-mode toggle (LLD §3 Assumptions) is a
        // separate, not-yet-built feature this slice only consumes once it
        // exists; until then this falls back to always 'subsystem' so the
        // subgraph palette is never spuriously disabled.
        usesSubsystemVariant: true,
      } as Partial<S>);

      logger.debug('editSessionSlice: enterEditMode succeeded', {
        action: 'enterEditMode',
        component: 'editSessionSlice',
        projectId,
      });
      return true;
    },

    excludedLinks: [],

    exitEditMode: () => {
      useGlobalStore.getState().releaseExclusiveMode(projectId, 'usecase-edit');
      set({mode: 'view'} as Partial<S>);

      logger.debug('editSessionSlice: exitEditMode', {
        action: 'exitEditMode',
        component: 'editSessionSlice',
        projectId,
      });
    },

    isMutating: false,

    kvCasesById: {},

    mode: 'view',

    pairLinksById: {},

    resetSessionLocalMaps: (): void => {
      set({
        excludedLinks: [] as Connection[],
        kvCasesById: {} as Record<string, KvCase[]>,
        pairLinksById: {} as Record<string, SubgraphPairDto>,
        subgraphProvenanceById: {} as Record<string, SubgraphProvenance>,
      } as Partial<S>);
    },

    subgraphProvenanceById: {},

    usesSubsystemVariant: true,
  };
}

// ---------------------------------------------------------------------------
// withMutationLock
// ---------------------------------------------------------------------------

/**
 * Runs `action` under the single serial mutation lock (`isMutating`,
 * REQ-065): calls `beginMutation()`, awaits `action()`, and calls
 * `endMutation()` in a `finally` block so the lock always releases, even if
 * `action` throws.
 *
 * Throws — does not toast — when called while `mode !== 'edit'`. This
 * signals a bug in the caller, not a user-facing failure: every legitimate
 * call site is already UI-gated to Edit mode only (palettes, context-menu
 * items, the properties panel's editable fields, the Key Configurator
 * panel don't render outside Edit mode), so reaching this function with the
 * wrong mode means some code path invoked a mutation without going through
 * that gating. The one documented exception, `deleteSelection`/
 * `pasteSelection` (reachable via a global `keydown` listener with no
 * render-layer gate), checks `mode` itself *before* calling this function
 * and no-ops silently instead — that call site is a different chapter, not
 * built here.
 *
 * @param get - Zustand get function for a store composing `EditSessionSlice`.
 * @param action - The backend call (or other async work) to run under the lock.
 */
export async function withMutationLock<S extends EditSessionSlice, T>(
  get: StoreApi<S>['getState'],
  action: () => Promise<T>,
): Promise<T> {
  const {beginMutation, endMutation, mode} = get();
  if (mode !== 'edit') {
    throw new Error('withMutationLock called outside Edit mode');
  }

  beginMutation();
  try {
    return await action();
  } finally {
    endMutation();
  }
}
