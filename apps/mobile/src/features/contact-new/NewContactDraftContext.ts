import { createContext } from 'react';

import type { ContactDraft } from '@/features/contact-detail/contactFields';

export type NewContactDraftValue = {
  draft: ContactDraft;
  setField: <F extends keyof ContactDraft>(field: F, value: ContactDraft[F]) => void;
  // Fills the fields `fieldsFor` returns for the draft as it is then over it, and remembers it for Undo.
  fillFields: (fieldsFor: (draft: ContactDraft) => Partial<ContactDraft>) => void;
  filledFields: (keyof ContactDraft)[];
  undoFill: () => void;
  avatarUri: string | null;
  setAvatarUri: (uri: string | null) => void;
  listIds: string[];
  setListIds: (listIds: string[]) => void;
};

const NewContactDraftContext = createContext<NewContactDraftValue | null>(null);

export default NewContactDraftContext;
