import { createContext } from 'react';

import type { ContactDraft, FillSource } from '@/features/contact-detail/contactFields';

export type NewContactDraftValue = {
  draft: ContactDraft;
  setField: <F extends keyof ContactDraft>(field: F, value: ContactDraft[F]) => void;
  // Fills the fields `fieldsFor` returns for the draft as it is then over it, and `photoUri` while no
  // photo is set, and remembers it for Undo.
  fillFields: (
    source: FillSource,
    fieldsFor: (draft: ContactDraft) => Partial<ContactDraft>,
    photoUri?: string,
  ) => void;
  // The last fill: who filled it and the fields it filled (none when it brought only the photo).
  fill: { source: FillSource; fields: (keyof ContactDraft)[] } | null;
  undoFill: () => void;
  avatarUri: string | null;
  setAvatarUri: (uri: string | null) => void;
  listIds: string[];
  setListIds: (listIds: string[]) => void;
};

const NewContactDraftContext = createContext<NewContactDraftValue | null>(null);

export default NewContactDraftContext;
