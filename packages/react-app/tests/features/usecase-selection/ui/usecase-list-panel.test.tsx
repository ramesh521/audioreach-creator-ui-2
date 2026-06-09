/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@qualcomm-ui/react/button', () => ({
  Button: ({children, onClick}: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  IconButton: ({'aria-label': ariaLabel, onClick}: any) => (
    <button aria-label={ariaLabel} onClick={onClick} />
  ),
}));

jest.mock('@qualcomm-ui/react/checkbox', () => ({
  Checkbox: ({checked, onCheckedChange}: any) => (
    <input
      checked={checked ?? false}
      onChange={(e) => onCheckedChange(e.target.checked)}
      type="checkbox"
    />
  ),
}));

// Stateful Dialog mock — dialog starts closed; Trigger opens it; CloseTrigger closes it
jest.mock('@qualcomm-ui/react/dialog', () => {
  const React = jest.requireActual('react');
  const DialogContext = React.createContext({
    open: false,
    setOpen: (_: boolean) => {},
  });

  return {
    Dialog: {
      Body: ({children}: any) => <div>{children}</div>,
      CloseButton: () => {
        const {setOpen} = React.useContext(DialogContext);
        return (
          <button aria-label="Close dialog" onClick={() => setOpen(false)} />
        );
      },
      CloseTrigger: ({children}: any) => {
        const {setOpen} = React.useContext(DialogContext);
        return <span onClick={() => setOpen(false)}>{children}</span>;
      },
      Description: ({children}: any) => <p>{children}</p>,
      FloatingPortal: ({children}: any) => {
        const {open} = React.useContext(DialogContext);
        return open ? <div>{children}</div> : null;
      },
      Footer: ({children}: any) => <div>{children}</div>,
      Heading: ({children}: any) => <h2>{children}</h2>,
      IndicatorIcon: () => <span />,
      Root: ({children}: any) => {
        const [open, setOpen] = React.useState(false);
        return (
          <DialogContext.Provider value={{open, setOpen}}>
            <div>{children}</div>
          </DialogContext.Provider>
        );
      },
      Trigger: ({children}: any) => {
        const {setOpen} = React.useContext(DialogContext);
        return <span onClick={() => setOpen(true)}>{children}</span>;
      },
    },
  };
});

jest.mock('lucide-react', () => ({
  ChevronDown: () => <span />,
  ChevronRight: () => <span />,
  PanelTopClose: () => <span />,
  PanelTopOpen: () => <span />,
  Settings: () => <span />,
  Trash2: () => <span />,
}));

import UsecaseListPanel from '~features/usecase-selection/ui/usecase-list-panel';

const mockUsecaseData = [
  {
    expanded: true,
    name: 'Default',
    usecases: [
      {
        keyValueCollection: [
          {
            keyInfo: {keyLabel: 'DeviceTX'},
            valueInfo: {valueLabel: 'Speaker_Mic'},
          },
        ],
        systemId: 'UC_001',
      },
    ],
  },
] as any;

const formatUsecaseDisplay = (usecase: any): string =>
  usecase.keyValueCollection
    .map((kv: any) => kv.valueInfo.valueLabel)
    .join(' • ');

const defaultProps = {
  expandedCategories: ['Default'],
  formatUsecaseDisplay,
  handleSelectAll: jest.fn(),
  handleSelectUsecase: jest.fn(),
  isUsecaseChecked: jest.fn(() => false),
  onClose: jest.fn(),
  onDeleteSelected: jest.fn(),
  selectedUsecases: [],
  toggleCategoryExpansion: jest.fn(),
  usecaseData: mockUsecaseData,
};

describe('UsecaseListPanel — delete button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Delete button hidden when nothing is selected ──────────────────────

  it('does not render delete button when no usecases are selected', () => {
    render(<UsecaseListPanel {...defaultProps} selectedUsecases={[]} />);

    expect(
      screen.queryByRole('button', {name: 'Delete'}),
    ).not.toBeInTheDocument();
  });

  // ── 2. Delete button visible when items are selected ─────────────────────

  it('renders delete button when at least one usecase is selected', () => {
    render(
      <UsecaseListPanel {...defaultProps} selectedUsecases={['Speaker_Mic']} />,
    );

    expect(screen.getByRole('button', {name: 'Delete'})).toBeInTheDocument();
  });

  // ── 3. Clicking trash icon opens dialog, does NOT call onDeleteSelected ───

  it('does not call onDeleteSelected when trash icon is clicked', async () => {
    const user = userEvent.setup();
    const onDeleteSelected = jest.fn();

    render(
      <UsecaseListPanel
        {...defaultProps}
        onDeleteSelected={onDeleteSelected}
        selectedUsecases={['Speaker_Mic']}
      />,
    );

    // Click trash icon — opens dialog, does not delete
    await user.click(screen.getByRole('button', {name: 'Delete'}));

    expect(onDeleteSelected).not.toHaveBeenCalled();
  });

  // ── 4. Clicking Delete in dialog calls onDeleteSelected ───────────────────

  it('calls onDeleteSelected when Delete button in dialog is clicked', async () => {
    const user = userEvent.setup();
    const onDeleteSelected = jest.fn();

    render(
      <UsecaseListPanel
        {...defaultProps}
        onDeleteSelected={onDeleteSelected}
        selectedUsecases={['Speaker_Mic']}
      />,
    );

    // Open dialog first
    await user.click(screen.getByRole('button', {name: 'Delete'}));
    // Click dialog Delete button
    await user.click(screen.getByText('Delete'));

    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
  });

  // ── 5. Clicking Cancel does NOT call onDeleteSelected ─────────────────────

  it('does not call onDeleteSelected when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onDeleteSelected = jest.fn();

    render(
      <UsecaseListPanel
        {...defaultProps}
        onDeleteSelected={onDeleteSelected}
        selectedUsecases={['Speaker_Mic']}
      />,
    );

    // Open dialog first
    await user.click(screen.getByRole('button', {name: 'Delete'}));
    // Click Cancel
    await user.click(screen.getByText('Cancel'));

    expect(onDeleteSelected).not.toHaveBeenCalled();
  });
});
