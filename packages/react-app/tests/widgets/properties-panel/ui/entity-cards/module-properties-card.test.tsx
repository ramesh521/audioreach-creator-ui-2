/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

jest.mock('~entities/spf-modules', () => ({
  patchSpfModule: jest.fn(),
}));

import {render, screen} from '@testing-library/react';

import {ModulePropertiesCard} from '~widgets/properties-panel/ui/entity-cards/module-properties-card';

import {makeGraphData} from './test-graph-data';

describe('ModulePropertiesCard', () => {
  it('renders static fields and dynamic port editability', () => {
    render(
      <ModulePropertiesCard
        graphData={makeGraphData()}
        isEditing
        moduleId="mod-1"
        onModuleAliasChange={jest.fn()}
        onModuleContainerChange={jest.fn()}
        onModulePortCountChange={jest.fn()}
        projectId="proj-1"
      />,
    );

    expect(screen.getByText('Alias')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Copy Module ID'})).toBeEnabled();
    expect(
      screen.getByRole('button', {name: 'Copy Instance ID'}),
    ).toBeEnabled();
    expect(screen.getByDisplayValue('3')).toHaveAttribute('readOnly');
    expect(screen.getByDisplayValue('4')).not.toHaveAttribute('readOnly');
  });
});
