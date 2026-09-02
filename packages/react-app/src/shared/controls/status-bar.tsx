/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {electronApi} from '~shared/api/electron-api';
import {useGlobalStore} from '~shared/store/global-store';
import packageJson from '~root/package.json';

export const StatusBar: React.FC = () => {
  const filePath = useGlobalStore(
    (state) =>
      state.openProjects.find((p) => p.projectId === state.activeProjectId)
        ?.filePath,
  );
  const appVersion = electronApi?.versions.appVersion();

  return (
    <div className="flex shrink-0 items-center justify-between border-t px-4 py-1 text-xs">
      <span className="truncate">{filePath}</span>
      <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
        <span className="font-semibold">{packageJson.name}</span>
        {appVersion && <span>v{appVersion}</span>}
      </div>
    </div>
  );
};
