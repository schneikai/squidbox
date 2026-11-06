import { type ReactNode, useMemo, useReducer, useRef, useState } from 'react';

import NewContactDraftContext, { type NewContactDraftValue } from './NewContactDraftContext';
import newContactDraftReducer, { initialNewContactDraftState } from './newContactDraftReducer';

type NewContactDraftProviderProps = { children: ReactNode };

/**
 * The New contact sheet's draft, shared by its steps (the form and its Lists step): the fields as
 * typed (contactDraft), the photo's `avatarUri`, the chosen `listIds`, and the last fill from a
 * screenshot or an X profile (`fill`), which may bring the photo too and be extended by a later
 * answer (From link's assistant pass), applied against the draft as it is when it lands, with each
 * filled field's value from before it so Undo can bring it back: only the fields still as filled and
 * the photo while it is still the fill's, so an edit made since stays (newContactDraftReducer).
 */
export default function NewContactDraftProvider({ children }: NewContactDraftProviderProps) {
  const [{ draft, avatarUri, fill }, dispatch] = useReducer(newContactDraftReducer, null, initialNewContactDraftState);
  const [listIds, setListIds] = useState<string[]>([]);
  const lastFillId = useRef(0);

  // Made once: they only dispatch.
  const actions = useMemo(
    () =>
      ({
        setField: (field, value) => dispatch({ type: 'set', field, value }),
        setFieldIfEmpty: (field, value) => dispatch({ type: 'setIfEmpty', field, value }),
        fillFields: (source, fieldsFor, photoUri) => {
          const id = ++lastFillId.current;
          dispatch({ type: 'fill', id, source, fieldsFor, photoUri });
          return id;
        },
        extendFill: (id, fieldsFor) => dispatch({ type: 'extendFill', id, fieldsFor }),
        undoFill: () => dispatch({ type: 'undoFill' }),
        setAvatarUri: (uri) => dispatch({ type: 'avatar', uri }),
      }) satisfies Partial<NewContactDraftValue>,
    [],
  );

  const value = useMemo<NewContactDraftValue>(
    () => ({ ...actions, draft, fill, avatarUri, listIds, setListIds }),
    [actions, draft, avatarUri, listIds, fill],
  );

  return <NewContactDraftContext.Provider value={value}>{children}</NewContactDraftContext.Provider>;
}
