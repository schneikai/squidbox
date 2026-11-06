import { type ReactNode, useMemo, useState } from 'react';

import NewContactDraftContext, { type NewContactDraftValue } from './NewContactDraftContext';

import { type ContactDraft, contactDraft, draftWithChanges } from '@/features/contact-detail/contactFields';

// A fill from a screenshot: the fields it filled, their values before it and what it put in them.
type Fill = { fields: (keyof ContactDraft)[]; before: Partial<ContactDraft>; after: Partial<ContactDraft> };

type NewContactDraftProviderProps = { children: ReactNode };

/**
 * The New contact sheet's draft, shared by its steps (the form and its Lists step): the fields as
 * typed (contactDraft), the picked photo's `avatarUri`, the chosen `listIds`, and what the assistant
 * filled from a screenshot (`filledFields`), with each filled field's value from before that fill so
 * Undo can bring it back: only the fields still as filled, so an edit made since stays.
 */
export default function NewContactDraftProvider({ children }: NewContactDraftProviderProps) {
  const [draft, setDraft] = useState(() => contactDraft());
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [listIds, setListIds] = useState<string[]>([]);
  const [fill, setFill] = useState<Fill | null>(null);

  const value = useMemo<NewContactDraftValue>(
    () => ({
      draft,
      setField: (field, text) => setDraft((current) => ({ ...current, [field]: text })),
      fillFields: (fields) => {
        const names = Object.keys(fields) as (keyof ContactDraft)[];
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
        setDraft((current) => draftWithChanges(current, fill.fields, fill.after, fill.before));
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
