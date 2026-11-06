import type { NewContactDraftState } from './newContactDraftReducer';

import { contactDraft } from '@/features/contact-detail/contactFields';

/** The New contact sheet before anything is typed. */
export default function initialNewContactDraftState(): NewContactDraftState {
  return { draft: contactDraft(), avatarUri: null, fill: null };
}
