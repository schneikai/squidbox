import { type ReactNode, useMemo, useReducer, useState } from 'react';

import NewContactDraftContext, { type NewContactDraftValue } from './NewContactDraftContext';
import newContactDraftReducer from './newContactDraftReducer';

import { contactDraft } from '@/features/contact-detail/contactFields';

type NewContactDraftProviderProps = { children: ReactNode };

/**
 * The New contact sheet's draft, shared by its steps (the form and its Lists step): the fields as
 * typed (contactDraft), the picked photo's `avatarUri`, the chosen `listIds`, and what the assistant
 * filled from a screenshot (`filledFields`), with each filled field's value from before that fill so
 * Undo can bring it back: only the fields still as filled, so an edit made since stays
 * (newContactDraftReducer).
 */
export default function NewContactDraftProvider({ children }: NewContactDraftProviderProps) {
  const [{ draft, fill }, dispatch] = useReducer(newContactDraftReducer, null, () => ({
    draft: contactDraft(),
    fill: null,
  }));
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [listIds, setListIds] = useState<string[]>([]);

  const value = useMemo<NewContactDraftValue>(
    () => ({
      draft,
      setField: (field, value) => dispatch({ type: 'set', field, value }),
      fillFields: (fieldsFor) => dispatch({ type: 'fill', fieldsFor }),
      filledFields: fill?.fields ?? [],
      undoFill: () => dispatch({ type: 'undoFill' }),
      avatarUri,
      setAvatarUri,
      listIds,
      setListIds,
    }),
    [draft, avatarUri, listIds, fill],
  );

  return <NewContactDraftContext.Provider value={value}>{children}</NewContactDraftContext.Provider>;
}
