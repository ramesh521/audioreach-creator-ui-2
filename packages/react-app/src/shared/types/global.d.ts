import type {
  ConfigApi,
  MruStoreApi,
  ProjectContextApi,
  SaveFileApi,
} from '@audioreach-creator-ui/api-utils';

declare global {
  interface Window {
    configApi: ConfigApi;
    mruStoreApi: MruStoreApi;
    projectContextApi: ProjectContextApi;
    saveFileApi: SaveFileApi;
  }
}
