/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {create} from 'zustand';

import type {UsecaseItem} from '~entities/usecases';

// ── Search scope ─────────────────────────────────────────────────────────────

export const SEARCH_SCOPE_OPTIONS = [
  'All',
  'Subgraphs',
  'Containers',
  'Modules',
  'Subsystems',
] as const satisfies readonly string[];

export type SearchScopeOption = (typeof SEARCH_SCOPE_OPTIONS)[number];

// ── Per-project state ─────────────────────────────────────────────────────────

interface UsecaseSelectionControlState {
  /** Expanded category names in the list panel */
  expandedCategories: string[];
  /**
   * Recently selected usecases (max 10, most-recent first).
   * Updated when the selection dropdown closes.
   */
  recentlySelected: UsecaseItem[];
  /** Past search terms for future autocomplete (max 20, most-recent first) */
  searchHistory: string[];
  /** Selected scope option */
  searchScopeOption: SearchScopeOption;
  /** Current search term */
  searchTerm: string;
}

const DEFAULT_STATE: UsecaseSelectionControlState = {
  expandedCategories: [],
  recentlySelected: [],
  searchHistory: [],
  searchScopeOption: 'All',
  searchTerm: '',
};

// ── Store interface ───────────────────────────────────────────────────────────

interface UsecaseSelectionControlStore {
  /**
   * Merge `usecases` into the recently-selected cache (deduped by systemId,
   * most-recent first, max 10). Call this when the selection dropdown closes.
   */
  addToRecentlySelected: (
    projectGroupId: string,
    usecases: UsecaseItem[],
  ) => void;

  /** Append a term to the search history (deduped, max 20) */
  addToSearchHistory: (projectGroupId: string, term: string) => void;
  /** Remove items from the recently-selected cache by name. Call after deletion. */
  removeFromRecentlySelected: (projectGroupId: string, names: string[]) => void;
  /** Replace the expanded-categories list */
  setExpandedCategories: (projectGroupId: string, categories: string[]) => void;
  /** Change the scope selector value */
  setSearchScopeOption: (
    projectGroupId: string,
    scope: SearchScopeOption,
  ) => void;
  /** Update the search term */
  setSearchTerm: (projectGroupId: string, term: string) => void;
  stateByProject: Record<string, UsecaseSelectionControlState>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const getProjectState = (
  store: UsecaseSelectionControlStore,
  projectGroupId: string,
): UsecaseSelectionControlState =>
  store.stateByProject[projectGroupId] ?? DEFAULT_STATE;

type SetState = (
  partial: (
    state: UsecaseSelectionControlStore,
  ) => Partial<UsecaseSelectionControlStore>,
) => void;
type GetState = () => UsecaseSelectionControlStore;

const patchProjectState = (
  set: SetState,
  get: GetState,
  projectGroupId: string,
  patch: Partial<UsecaseSelectionControlState>,
): void => {
  const current = getProjectState(get(), projectGroupId);
  set((s) => ({
    stateByProject: {
      ...s.stateByProject,
      [projectGroupId]: {...current, ...patch},
    },
  }));
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useUsecaseSelectionControlStore =
  create<UsecaseSelectionControlStore>((set, get) => ({
    addToRecentlySelected: (projectGroupId, usecases) => {
      if (usecases.length === 0) {
        return;
      }
      const current = getProjectState(get(), projectGroupId);
      // Prepend new usecases, dedup by systemId, keep most-recent first, max 10
      const seenIds = new Set(
        current.recentlySelected
          .filter((u) => u.systemId)
          .map((u) => u.systemId!),
      );
      const newEntries = usecases.filter((u) => {
        if (!u.systemId || seenIds.has(u.systemId)) {
          return false;
        }
        seenIds.add(u.systemId);
        return true;
      });
      const merged = [...newEntries, ...current.recentlySelected].slice(0, 10);
      patchProjectState(set, get, projectGroupId, {recentlySelected: merged});
    },

    addToSearchHistory: (projectGroupId, term) => {
      const current = getProjectState(get(), projectGroupId);
      const trimmed = term.trim();
      if (!trimmed || current.searchHistory.includes(trimmed)) {
        return;
      }
      patchProjectState(set, get, projectGroupId, {
        searchHistory: [trimmed, ...current.searchHistory].slice(0, 20),
      });
    },

    removeFromRecentlySelected: (projectGroupId, names) => {
      const current = getProjectState(get(), projectGroupId);
      const nameSet = new Set(names);
      const filtered = current.recentlySelected.filter(
        (u) => !nameSet.has(u.name),
      );
      if (filtered.length !== current.recentlySelected.length) {
        patchProjectState(set, get, projectGroupId, {
          recentlySelected: filtered,
        });
      }
    },

    setExpandedCategories: (projectGroupId, categories) => {
      patchProjectState(set, get, projectGroupId, {
        expandedCategories: categories,
      });
    },

    setSearchScopeOption: (projectGroupId, scope) => {
      patchProjectState(set, get, projectGroupId, {
        searchScopeOption: scope,
      });
    },

    setSearchTerm: (projectGroupId, term) => {
      patchProjectState(set, get, projectGroupId, {searchTerm: term});
    },

    stateByProject: {},
  }));
