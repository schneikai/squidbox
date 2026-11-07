import { createContext } from 'react';

import type { Fill } from './newContactDraftReducer';

import type { ContactDraft, FillSource } from '@/features/contact-detail/contactFields';

type FieldsFor = (draft: ContactDraft) => Partial<ContactDraft>;

export type NewContactDraftValue = {
  draft: ContactDraft;
  setField: <F extends keyof ContactDraft>(field: F, value: ContactDraft[F]) => void;
  // Fills the fields `fieldsFor` returns for the draft as it is then over it, and `photoUri` while no
  // photo is set, and remembers it for Undo.
  fillFields: (source: FillSource, fieldsFor: FieldsFor, photoUri?: string) => void;
  // The last fill: what it was filled from, the fields it filled, and its photo.
  fill: Pick<Fill, 'source' | 'fields' | 'photoUri'> | null;
  undoFill: () => void;
  avatarUri: string | null;
  setAvatarUri: (uri: string | null) => void;
  listIds: string[];
  setListIds: (listIds: string[]) => void;
};

const NewContactDraftContext = createContext<NewContactDraftValue | null>(null);

export default NewContactDraftContext;
