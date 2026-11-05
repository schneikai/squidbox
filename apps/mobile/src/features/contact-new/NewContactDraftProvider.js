import { useMemo, useState } from 'react';

import NewContactDraftContext from './NewContactDraftContext';

import { contactDraft } from '@/features/contact-detail/contactFields';

/**
 * The New contact sheet's draft, shared by its steps (the form and its Lists step): the fields as
 * typed (contactDraft), the picked photo's `avatarUri`, the chosen `listIds`, and what the assistant
 * filled from a screenshot (`filledFields`), with each filled field's value from before that fill so
 * Undo can bring it back: only the fields still as filled, so an edit made since stays.
 */
export default function NewContactDraftProvider({ children }) {
  const [draft, setDraft] = useState(() => contactDraft());
  const [avatarUri, setAvatarUri] = useState(null);
  const [listIds, setListIds] = useState([]);
  const [fill, setFill] = useState(null); // { fields, before, after }

  const value = useMemo(
    () => ({
      draft,
      setField: (field, text) => setDraft((current) => ({ ...current, [field]: text })),
      // Fills these fields over the draft and remembers it for Undo.
      fillFields: (fields) => {
        const names = Object.keys(fields);
        setFill({
          fields: names,
          before: Object.fromEntries(names.map((field) => [field, draft[field]])),
          after: fields,
        });
        setDraft((current) => ({ ...current, ...fields }));
      },
      filledFields: fill?.fields ?? [],
      undoFill: () => {
        if (!fill) return;
        setDraft((current) => {
          const next = { ...current };
          for (const field of fill.fields) {
            if (JSON.stringify(current[field]) === JSON.stringify(fill.after[field])) next[field] = fill.before[field];
          }
          return next;
        });
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
