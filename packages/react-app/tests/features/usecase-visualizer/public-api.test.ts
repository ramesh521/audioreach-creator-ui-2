/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');
jest.mock('~features/usecase-visualizer/ui/usecase-visualizer', () => ({
  UsecaseVisualizer: () => null,
}));

import * as graphEntityApi from '~entities/graph';
import * as visualizerPublicApi from '~features/usecase-visualizer';

describe('graph entity public API — canonical const objects', () => {
  it('exports NODE_KIND, EDGE_KIND, PORT_IO_TYPE, PORT_STATUS, MODULE_SHAPE', () => {
    expect(graphEntityApi.NODE_KIND).toBeDefined();
    expect(graphEntityApi.EDGE_KIND).toBeDefined();
    expect(graphEntityApi.PORT_IO_TYPE).toBeDefined();
    expect(graphEntityApi.PORT_STATUS).toBeDefined();
    expect(graphEntityApi.MODULE_SHAPE).toBeDefined();
  });
});

describe('usecase-visualizer public API — core exports', () => {
  it('exports NODE_DIMENSIONS and calculateModuleHeight', () => {
    expect(visualizerPublicApi.NODE_DIMENSIONS).toBeDefined();
    expect(typeof visualizerPublicApi.calculateModuleHeight).toBe('function');
  });

  it('exports VISUALIZER_MODE', () => {
    expect(visualizerPublicApi.VISUALIZER_MODE).toBeDefined();
  });

  it('exports UsecaseVisualizer and it is defined', () => {
    expect(visualizerPublicApi.UsecaseVisualizer).toBeDefined();
  });
});

describe('usecase-visualizer public API — internal symbols are not exported', () => {
  it('does not export createVisualizerStore, toReactFlow*, or SearchHighlightState', () => {
    const keys = Object.keys(visualizerPublicApi);
    expect(keys).not.toContain('createVisualizerStore');
    expect(keys).not.toContain('VisualizerInternalStore');
    expect(keys).not.toContain('toReactFlowNodes');
    expect(keys).not.toContain('toReactFlowEdges');
    expect(keys).not.toContain('SearchHighlightState');
  });
});
