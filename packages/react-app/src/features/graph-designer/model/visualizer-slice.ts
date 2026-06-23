/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {Viewport} from '@xyflow/react';
import type {StoreApi} from 'zustand';

import type {LevelView} from '~entities/graph';
import {logger} from '~shared/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphView {
  expandedSubgraphIds: string[];
  subsystemNavigationStack: string[];
}

export interface SearchHighlight {
  activeNodeId: string | null;
  matchNodeIds: string[];
}

export interface VisualizerSlice {
  clearLevelView: () => void;
  clearSearchHighlight: () => void;
  clearSelection: () => void;
  effectiveLevelView: LevelView | null;
  error: string | null;
  graphView: GraphView | null;
  isLoading: boolean;
  levelView: LevelView | null;
  searchHighlight: SearchHighlight | null;
  selectedEdgeIds: string[];
  selectedNodeIds: string[];
  setEffectiveLevelView: (lv: LevelView) => void;
  setGraphView: (graphView: GraphView | null) => void;
  setLevelView: (lv: LevelView) => void;
  setSearchHighlight: (
    matchNodeIds: string[],
    activeNodeId: string | null,
  ) => void;
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  setViewport: (viewport: Viewport) => void;
  viewport: Viewport;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_VIEWPORT: Viewport = {x: 0, y: 0, zoom: 1};

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

/**
 * Creates the visualizer slice for composing into a tab store.
 *
 * @param set - Zustand set function bound to the parent store state.
 * @returns The initial state and actions for the visualizer slice.
 */
export function createVisualizerSlice<S extends VisualizerSlice>(
  set: StoreApi<S>['setState'],
): VisualizerSlice {
  return {
    clearLevelView: () => {
      logger.debug('visualizerSlice: clearLevelView');
      set({effectiveLevelView: null, levelView: null} as Partial<S>);
    },

    clearSearchHighlight: () => {
      logger.debug('visualizerSlice: clearSearchHighlight');
      set({searchHighlight: null} as Partial<S>);
    },

    clearSelection: () => {
      logger.debug('visualizerSlice: clearSelection');
      set({
        selectedEdgeIds: [] as string[],
        selectedNodeIds: [] as string[],
      } as Partial<S>);
    },

    effectiveLevelView: null,

    error: null,

    graphView: null,

    isLoading: false,

    levelView: null,

    searchHighlight: null,

    selectedEdgeIds: [],

    selectedNodeIds: [],

    setEffectiveLevelView: (lv: LevelView) => {
      logger.debug('visualizerSlice: setEffectiveLevelView', {
        action: 'setEffectiveLevelView',
        component: 'visualizerSlice',
      });
      set({effectiveLevelView: lv} as Partial<S>);
    },

    setGraphView: (graphView: GraphView | null) => {
      logger.debug('visualizerSlice: setGraphView', {
        action: 'setGraphView',
        component: 'visualizerSlice',
      });
      set({graphView} as Partial<S>);
    },

    setLevelView: (lv: LevelView) => {
      logger.debug('visualizerSlice: setLevelView', {
        action: 'setLevelView',
        component: 'visualizerSlice',
      });
      set({levelView: lv} as Partial<S>);
    },

    setSearchHighlight: (
      matchNodeIds: string[],
      activeNodeId: string | null,
    ) => {
      logger.debug('visualizerSlice: setSearchHighlight', {
        action: 'setSearchHighlight',
        component: 'visualizerSlice',
      });
      set({
        searchHighlight: {
          activeNodeId,
          matchNodeIds,
        },
      } as Partial<S>);
    },

    setSelection: (nodeIds: string[], edgeIds: string[]) => {
      logger.debug('visualizerSlice: setSelection', {
        action: 'setSelection',
        component: 'visualizerSlice',
      });
      set({
        selectedEdgeIds: edgeIds,
        selectedNodeIds: nodeIds,
      } as Partial<S>);
    },

    setViewport: (viewport: Viewport) => {
      logger.debug('visualizerSlice: setViewport', {
        action: 'setViewport',
        component: 'visualizerSlice',
      });
      set({viewport} as Partial<S>);
    },

    viewport: DEFAULT_VIEWPORT,
  };
}
