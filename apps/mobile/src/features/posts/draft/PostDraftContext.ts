import { createContext, type Dispatch } from 'react';

import type { PostDraft, PostDraftAction } from './postDraftReducer';

export type PostDraftValue = { draft: PostDraft | null; dispatch: Dispatch<PostDraftAction> };

const PostDraftContext = createContext<PostDraftValue | null>(null);

export default PostDraftContext;
