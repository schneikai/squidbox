import { useMemo, useState } from 'react';

import NewContactDraftContext from './NewContactDraftContext';

import { contactDraft } from '@/features/contact-detail/contactFields';

/**
 * The New contact sheet's draft, shared by its steps (the form and its Lists step): the fields as
 * typed (contactDraft), the picked photo's `avatarUri`, the chosen `listIds`, and what the assistant
 * filled from a screenshot (`filledFields`), with the draft from before that fill so Undo can bring
 * it back.
 */
export default function NewContactDraftProvider({ children }) {
  const [draft, setDraft] = useState(() => contactDraft());
  const [avatarUri, setAvatarUri] = useState(null);
  const [listIds, setListIds] = useState([]);
  const [fill, setFill] = useState(null); // { fields, before }

  const value = useMemo(
    () => ({
      draft,
      setField: (field, text) => setDraft((current) => ({ ...current, [field]: text })),
      // Fills these fields over the draft and remembers it for Undo.
      fillFields: (fields) => {
        setFill({ fields: Object.keys(fields), before: draft });
        setDraft((current) => ({ ...current, ...fields }));
      },
      filledFields: fill?.fields ?? [],
      undoFill: () => {
        if (!fill) return;
        setDraft(fill.before);
        setFill(null);
      },
      avatarUri,
      setAvatarUri,
      listIds,
      setListIds,
    }),
    [draft, avatarUri, listIds, fill],
  );

  return <NewContactDraftContext.Provider value={value}>{children}</NewContactDraftContext.Provider>;
}
