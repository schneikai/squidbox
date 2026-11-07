import { type ContactDraft, type FillSource, draftWithChanges } from '@/features/contact-detail/contactFields';

// A fill from a screenshot or a profile link: what it was filled from (`source`, for its note), the
// fields it filled, their values before it and what it put in them, and the photo it brought (a fill
// never replaces one, so there was none before it).
export type Fill = {
  source: FillSource;
  fields: (keyof ContactDraft)[];
  before: Partial<ContactDraft>;
  after: Partial<ContactDraft>;
  photoUri: string | null;
};

export type NewContactDraftState = { draft: ContactDraft; avatarUri: string | null; fill: Fill | null };

type FieldsFor = (draft: ContactDraft) => Partial<ContactDraft>;

export type NewContactDraftAction =
  | { type: 'set'; field: keyof ContactDraft; value: ContactDraft[keyof ContactDraft] }
  // A photo picked or removed. It leaves the fill: Undo takes back the fill's photo only while it is
  // still the one shown.
  | { type: 'avatar'; uri: string | null }
  // `fieldsFor` gets the draft as it is when the fill lands, not when it was asked for; `photoUri`
  // is taken only while no photo is set.
  | { type: 'fill'; source: FillSource; fieldsFor: FieldsFor; photoUri?: string }
  | { type: 'undoFill' };

const pick = (from: Partial<ContactDraft>, fields: (keyof ContactDraft)[]): Partial<ContactDraft> =>
  Object.fromEntries(fields.map((field) => [field, from[field]]));

/**
 * The New contact sheet's draft, its photo and its last fill. A fill takes the fields it returns over
 * the draft as it is then, and its photo where none is set, and remembers their values from just
 * before it, so an edit made while the profile was read stays where the fill didn't go, a photo
 * picked meanwhile stays, and Undo brings it back where it did. Undo takes back only the fields still
 * as filled, and the photo only while it is still the fill's.
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
      const photoUri = action.photoUri && state.avatarUri === null ? action.photoUri : null;
      return {
        draft: { ...state.draft, ...after },
        avatarUri: photoUri ?? state.avatarUri,
        fill: {
          source: action.source,
          fields,
          before: pick(state.draft, fields),
          after,
          photoUri,
        },
      };
    }
    case 'undoFill': {
      const { fill } = state;
      if (!fill) return state;
      return {
        draft: draftWithChanges(state.draft, fill.fields, fill.after, fill.before),
        avatarUri: fill.photoUri && state.avatarUri === fill.photoUri ? null : state.avatarUri,
        fill: null,
      };
    }
  }
}
