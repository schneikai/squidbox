import { createContext } from 'react';

import type preloadAssetThumbnailsAsync from './assets/preloadAssetThumbnailsAsync';

import type { Session } from '@/library/session';

// Who the stored session is for (signed in or with its tokens dropped).
export type CloudUser = { id: Session['userId']; email: Session['email']; features: NonNullable<Session['features']> };

// Signed in always comes with its user; signed out may still name the session's owner.
export type CloudAccount =
  { isAuthenticated: true; user: CloudUser } | { isAuthenticated: false; user: CloudUser | null };

export type CloudContextValue = CloudAccount & {
  needsReauth: boolean;
  loginAsync: (email: string, password: string) => Promise<void>;
  logoutAsync: () => Promise<void>;
  preloadAssetThumbnailsAsync: typeof preloadAssetThumbnailsAsync;
};

const CloudContext = createContext<CloudContextValue | null>(null);

export default CloudContext;
