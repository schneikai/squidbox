import {
  type ContactDraft,
  type FillSource,
  contactDraft,
  draftWithChanges,
} from '@/features/contact-detail/contactFields';

// A fill from a screenshot or an X profile: who filled it, the fields it filled, their values before
// it and what it put in them, and the photo it brought (the one before it: none, since a fill never
// replaces a photo).
type Fill = {
  source: FillSource;
  fields: (keyof ContactDraft)[];
  before: Partial<ContactDraft>;
  after: Partial<ContactDraft>;
  photo: { before: string | null; after: string } | null;
};

export type NewContactDraftState = { draft: ContactDraft; avatarUri: string | null; fill: Fill | null };

export type NewContactDraftAction =
  | { type: 'set'; field: keyof ContactDraft; value: ContactDraft[keyof ContactDraft] }
  // A photo picked or removed. It leaves the fill: Undo takes back the fill's photo only while it is
  // still the one shown.
  | { type: 'avatar'; uri: string | null }
  // `fieldsFor` gets the draft as it is when the fill lands, not when it was asked for; `photoUri`
  // is taken only while no photo is set.
  | { type: 'fill'; source: FillSource; fieldsFor: (draft: ContactDraft) => Partial<ContactDraft>; photoUri?: string }
  | { type: 'undoFill' };

/** The New contact sheet before anything is typed. */
export function initialNewContactDraftState(): NewContactDraftState {
  return { draft: contactDraft(), avatarUri: null, fill: null };
}

/**
 * The New contact sheet's draft, its photo and its last fill. A fill takes the fields it returns over
 * the draft as it is then, and its photo where none is set, and remembers their values from just
 * before it, so an edit made while the profile was read stays where the fill didn't go, a photo
 * picked meanwhile stays, and Undo brings it back where it did; a fill of nothing changes nothing.
 * Undo takes back only the fields still as filled, and the photo only while it is still the fill's.
 */
export default function newContactDraftReducer(
  state: NewContactDraftState,
  action: NewContactDraftAction,
): NewContactDraftState {
  switch (action.type) {
    case 'set':
      return { ...state, draft: { ...state.draft, [action.field]: action.value } };
    case 'avatar':
      return { ...state, avatarUri: action.uri };
    case 'fill': {
      const after = action.fieldsFor(state.draft);
      const fields = Object.keys(after) as (keyof ContactDraft)[];
      const photo =
        action.photoUri && state.avatarUri === null ? { before: state.avatarUri, after: action.photoUri } : null;
      if (fields.length === 0 && !photo) return state;
      const before = Object.fromEntries(fields.map((field) => [field, state.draft[field]]));
      return {
        draft: { ...state.draft, ...after },
        avatarUri: photo ? photo.after : state.avatarUri,
        fill: { source: action.source, fields, before, after, photo },
      };
    }
    case 'undoFill': {
      const { fill } = state;
      if (!fill) return state;
      return {
        draft: draftWithChanges(state.draft, fill.fields, fill.after, fill.before),
        avatarUri: fill.photo && state.avatarUri === fill.photo.after ? fill.photo.before : state.avatarUri,
        fill: null,
      };
    }
  }
}
