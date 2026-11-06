import { type ReactNode, useMemo, useReducer, useState } from 'react';

import NewContactDraftContext, { type NewContactDraftValue } from './NewContactDraftContext';
import newContactDraftReducer, { initialNewContactDraftState } from './newContactDraftReducer';

type NewContactDraftProviderProps = { children: ReactNode };

/**
 * The New contact sheet's draft, shared by its steps (the form and its Lists step): the fields as
 * typed (contactDraft), the photo's `avatarUri`, the chosen `listIds`, and the last fill from a
 * screenshot or an X profile (`fill`), which may bring the photo too, applied against the draft as it
 * is when it lands, with each filled field's value from before it so Undo can bring it back: only
 * the fields still as filled and the photo while it is still the fill's, so an edit made since stays
 * (newContactDraftReducer).
 */
export default function NewContactDraftProvider({ children }: NewContactDraftProviderProps) {
  const [{ draft, avatarUri, fill }, dispatch] = useReducer(newContactDraftReducer, null, initialNewContactDraftState);
  const [listIds, setListIds] = useState<string[]>([]);

  const value = useMemo<NewContactDraftValue>(
    () => ({
      draft,
      setField: (field, value) => dispatch({ type: 'set', field, value }),
      fillFields: (source, fieldsFor, photoUri) => dispatch({ type: 'fill', source, fieldsFor, photoUri }),
      fill: fill && { source: fill.source, fields: fill.fields },
      undoFill: () => dispatch({ type: 'undoFill' }),
      avatarUri,
      setAvatarUri: (uri) => dispatch({ type: 'avatar', uri }),
      listIds,
      setListIds,
    }),
    [draft, avatarUri, listIds, fill],
  );

  return <NewContactDraftContext.Provider value={value}>{children}</NewContactDraftContext.Provider>;
}
