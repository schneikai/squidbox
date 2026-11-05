import { createContext } from 'react';

import type preloadAssetThumbnailsAsync from './assets/preloadAssetThumbnailsAsync';

export type CloudUser = { id: string; email: string | null; features: string[] };

export type CloudContextValue = {
  isAuthenticated: boolean;
  needsReauth: boolean;
  user: CloudUser | null;
  loginAsync: (email: string, password: string) => Promise<void>;
  logoutAsync: () => Promise<void>;
  preloadAssetThumbnailsAsync: typeof preloadAssetThumbnailsAsync;
};

const CloudContext = createContext<CloudContextValue | null>(null);

export default CloudContext;
