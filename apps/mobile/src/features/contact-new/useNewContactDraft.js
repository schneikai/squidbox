import { use } from 'react';

import NewContactDraftContext from './NewContactDraftContext';

export default function useNewContactDraft() {
  return use(NewContactDraftContext);
}
