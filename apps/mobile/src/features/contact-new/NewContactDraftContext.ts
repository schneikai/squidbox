import { createContext } from 'react';

import type { Fill } from './newContactDraftReducer';

import type { ContactDraft, FillSource } from '@/features/contact-detail/contactFields';

type FieldsFor = (draft: ContactDraft) => Partial<ContactDraft>;

export type NewContactDraftValue = {
  draft: ContactDraft;
  setField: <F extends keyof ContactDraft>(field: F, value: ContactDraft[F]) => void;
  // Fills the fields `fieldsFor` returns for the draft as it is then over it, and `photoUri` while no
  // photo is set, and remembers it for Undo; returns the fill's id, for extendFill.
  fillFields: (source: FillSource, fieldsFor: FieldsFor, photoUri?: string) => number;
  // Adds to fill `id`, by `source`, what `fieldsFor` returns and `photoUri`, while it is the last
  // fill, without overwriting what the user changed since; `onlyIntoEmpty` takes only fields that are
  // empty (newContactDraftReducer).
  extendFill: (
    id: number,
    source: FillSource,
    fieldsFor: FieldsFor,
    options?: { photoUri?: string; onlyIntoEmpty?: boolean },
  ) => void;
  // The last fill: who started it, the fields it filled and who filled each, and its photo.
  fill: Pick<Fill, 'source' | 'fields' | 'fieldSources' | 'photoUri'> | null;
  undoFill: () => void;
  avatarUri: string | null;
  setAvatarUri: (uri: string | null) => void;
  listIds: string[];
  setListIds: (listIds: string[]) => void;
};

const NewContactDraftContext = createContext<NewContactDraftValue | null>(null);

export default NewContactDraftContext;
