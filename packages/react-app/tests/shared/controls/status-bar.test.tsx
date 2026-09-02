/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

jest.mock('~shared/lib/logger');
jest.mock('~shared/api/electron-api');

import {render, screen} from '@testing-library/react';
import packageJson from '~root/package.json';

import * as electronApiModule from '~shared/api/electron-api';
import {StatusBar} from '~shared/controls/status-bar';
import {useGlobalStore} from '~shared/store/global-store';

describe('StatusBar', () => {
  beforeEach(() => {
    useGlobalStore.setState({
      activeProjectId: null,
      openProjects: [],
    });
    (electronApiModule.electronApi as any) = undefined;
  });

  // No active project (e.g. Start page) — path span renders empty, not undefined
  it('shows no file path when there is no active project', () => {
    render(<StatusBar />);
    expect(
      screen.getByText('', {selector: 'span.truncate'}),
    ).toBeInTheDocument();
  });

  // Active project's filePath is looked up from openProjects and displayed
  it("shows the active project's file path", () => {
    useGlobalStore.setState({
      activeProjectId: 'proj-1',
      openProjects: [
        {colorId: 1, filePath: '/workspace/project.qwsp', projectId: 'proj-1'},
      ],
    });

    render(<StatusBar />);

    expect(screen.getByText('/workspace/project.qwsp')).toBeInTheDocument();
  });

  // Only the active project's path is shown, even with multiple projects open
  it('ignores file paths from projects other than the active one', () => {
    useGlobalStore.setState({
      activeProjectId: 'proj-2',
      openProjects: [
        {colorId: 1, filePath: '/workspace/one.qwsp', projectId: 'proj-1'},
        {colorId: 2, filePath: '/workspace/two.qwsp', projectId: 'proj-2'},
      ],
    });

    render(<StatusBar />);

    expect(screen.getByText('/workspace/two.qwsp')).toBeInTheDocument();
    expect(screen.queryByText('/workspace/one.qwsp')).not.toBeInTheDocument();
  });

  it('shows the application name from package metadata', () => {
    render(<StatusBar />);
    expect(screen.getByText(packageJson.name)).toBeInTheDocument();
  });

  // Version is read from electronApi.versions.appVersion() and prefixed with "v"
  it('shows the app version when electronApi is available', () => {
    (electronApiModule.electronApi as any) = {
      versions: {appVersion: () => '8.3.11.6'},
    };

    render(<StatusBar />);

    expect(screen.getByText('v8.3.11.6')).toBeInTheDocument();
  });

  // Running outside Electron (e.g. browser preview) — no version span at all
  it('omits the version when electronApi is unavailable', () => {
    render(<StatusBar />);
    expect(screen.queryByText(/^v\d/)).not.toBeInTheDocument();
  });
});
