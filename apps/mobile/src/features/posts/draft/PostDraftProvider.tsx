import { type ReactNode, useMemo, useReducer } from 'react';

import PostDraftContext, { type PostDraftValue } from './PostDraftContext';
import postDraftReducer from './postDraftReducer';

type PostDraftProviderProps = { children: ReactNode };

/**
 * The post editor sheet's draft (postDraftReducer), shared by its steps: the post's first screen and a
 * channel's step. Null until the editor seeds it.
 */
export default function PostDraftProvider({ children }: PostDraftProviderProps) {
  const [draft, dispatch] = useReducer(postDraftReducer, null);
  const value = useMemo<PostDraftValue>(() => ({ draft, dispatch }), [draft]);
  return <PostDraftContext.Provider value={value}>{children}</PostDraftContext.Provider>;
}
