import { type ContactDraft, draftWithChanges } from '@/features/contact-detail/contactFields';

// A fill from a screenshot: the fields it filled, their values before it and what it put in them.
type Fill = { fields: (keyof ContactDraft)[]; before: Partial<ContactDraft>; after: Partial<ContactDraft> };

export type NewContactDraftState = { draft: ContactDraft; fill: Fill | null };

export type NewContactDraftAction =
  | { type: 'set'; field: keyof ContactDraft; value: ContactDraft[keyof ContactDraft] }
  // `fieldsFor` gets the draft as it is when the fill lands, not when it was asked for.
  | { type: 'fill'; fieldsFor: (draft: ContactDraft) => Partial<ContactDraft> }
  | { type: 'undoFill' };

/**
 * The New contact sheet's draft and its last fill from a screenshot. A fill takes the fields it
 * returns over the draft as it is then and remembers their values from just before it, so an edit
 * made while the screenshot was read stays where the fill didn't go, and Undo brings it back where
 * it did; a fill of nothing changes nothing. Undo takes back only the fields still as filled.
 */
export default function newContactDraftReducer(
  state: NewContactDraftState,
  action: NewContactDraftAction,
): NewContactDraftState {
  switch (action.type) {
    case 'set':
      return { ...state, draft: { ...state.draft, [action.field]: action.value } };
    case 'fill': {
      const after = action.fieldsFor(state.draft);
      const fields = Object.keys(after) as (keyof ContactDraft)[];
      if (fields.length === 0) return state;
      const before = Object.fromEntries(fields.map((field) => [field, state.draft[field]]));
      return { draft: { ...state.draft, ...after }, fill: { fields, before, after } };
    }
    case 'undoFill':
      if (!state.fill) return state;
      return {
        draft: draftWithChanges(state.draft, state.fill.fields, state.fill.after, state.fill.before),
        fill: null,
      };
  }
}
