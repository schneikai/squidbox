import PostDraftContext, { type PostDraftValue } from './PostDraftContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function usePostDraft(): PostDraftValue {
  return useRequiredContext(PostDraftContext, 'usePostDraft needs a PostDraftProvider above it');
}
