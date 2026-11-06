import NewContactDraftContext, { type NewContactDraftValue } from './NewContactDraftContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function useNewContactDraft(): NewContactDraftValue {
  return useRequiredContext(NewContactDraftContext, 'useNewContactDraft needs a NewContactDraftProvider above it');
}
