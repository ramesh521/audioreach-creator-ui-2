/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');

import {fireEvent, render, screen} from '@testing-library/react';

import {CopyableId} from '~shared/controls/copyable-id';

describe('CopyableId', () => {
  const writeTextMock = jest.fn().mockResolvedValue(undefined);

  beforeAll(() => {
    // navigator.clipboard is not implemented in this jsdom version — polyfill once.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText: writeTextMock},
      writable: true,
    });
  });

  beforeEach(() => {
    writeTextMock.mockClear();
  });

  it('renders the value string', () => {
    render(<CopyableId value="0x42B0" />);
    expect(screen.getByText('0x42B0')).toBeInTheDocument();
  });

  it('calls clipboard.writeText with the value when copy button is clicked', () => {
    render(<CopyableId value="0x42B0" />);

    fireEvent.click(screen.getByRole('button', {name: 'Copy to clipboard'}));

    expect(writeTextMock).toHaveBeenCalledWith('0x42B0');
    expect(writeTextMock).toHaveBeenCalledTimes(1);
  });

  it('copy button is active regardless of surrounding edit context', () => {
    render(
      <div data-editing="false">
        <CopyableId value="0xDEAD" />
      </div>,
    );

    const button = screen.getByRole('button', {name: 'Copy to clipboard'});
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    expect(writeTextMock).toHaveBeenCalledWith('0xDEAD');
  });

  it('applies className prop to the wrapper', () => {
    const {container} = render(
      <CopyableId className="test-class" value="0x1234" />,
    );
    expect(container.firstChild).toHaveClass('test-class');
  });
});
