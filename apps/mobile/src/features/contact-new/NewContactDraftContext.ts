import { createContext } from 'react';

import type { Fill, TextDraftField } from './newContactDraftReducer';

import type { ContactDraft, FillSource } from '@/features/contact-detail/contactFields';

type FieldsFor = (draft: ContactDraft) => Partial<ContactDraft>;

export type NewContactDraftValue = {
  draft: ContactDraft;
  setField: <F extends keyof ContactDraft>(field: F, value: ContactDraft[F]) => void;
  // Sets a text field only while it is still empty when this runs.
  setFieldIfEmpty: (field: TextDraftField, value: string) => void;
  // Fills the fields `fieldsFor` returns for the draft as it is then over it, and `photoUri` while no
  // photo is set, and remembers it for Undo; returns the fill's id, for extendFill.
  fillFields: (source: FillSource, fieldsFor: FieldsFor, photoUri?: string) => number;
  // Adds to fill `id` what `fieldsFor` returns, while it is the last fill, without overwriting what
  // the user changed since (newContactDraftReducer).
  extendFill: (id: number, fieldsFor: FieldsFor) => void;
  // The last fill: who filled it and the fields it filled (none when it brought only the photo).
  fill: Pick<Fill, 'source' | 'fields'> | null;
  undoFill: () => void;
  avatarUri: string | null;
  setAvatarUri: (uri: string | null) => void;
  listIds: string[];
  setListIds: (listIds: string[]) => void;
};

const NewContactDraftContext = createContext<NewContactDraftValue | null>(null);

export default NewContactDraftContext;
