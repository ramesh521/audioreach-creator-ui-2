import type {
  ConfigApi,
  KeyConfiguratorViewApi,
  LogViewApi,
  MruStoreApi,
  ProjectContextApi,
  SaveFileApi,
} from '@audioreach-creator-ui/api-utils';

declare global {
  interface Window {
    configApi: ConfigApi;
    keyConfiguratorViewApi: KeyConfiguratorViewApi;
    logViewApi: LogViewApi;
    mruStoreApi: MruStoreApi;
    projectContextApi: ProjectContextApi;
    saveFileApi: SaveFileApi;
  }
}
