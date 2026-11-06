import {
  type ContactDraft,
  type FillSource,
  contactDraft,
  draftWithChanges,
} from '@/features/contact-detail/contactFields';

/** A form field that holds text (all but the places). */
export type TextDraftField = Exclude<keyof ContactDraft, 'places'>;

// A fill from a screenshot or an X profile: its `id`, who filled it, the fields it filled, their
// values before it and what it put in them, and the photo it brought (a fill never replaces one, so
// there was none before it).
export type Fill = {
  id: number;
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
  // Sets the field only while it is still empty, when it lands (From link's name after the handle).
  | { type: 'setIfEmpty'; field: TextDraftField; value: string }
  // A photo picked or removed. It leaves the fill: Undo takes back the fill's photo only while it is
  // still the one shown.
  | { type: 'avatar'; uri: string | null }
  // `fieldsFor` gets the draft as it is when the fill lands, not when it was asked for; `photoUri`
  // is taken only while no photo is set.
  | { type: 'fill'; id: number; source: FillSource; fieldsFor: FieldsFor; photoUri?: string }
  // More for fill `id`, which came later (From link's assistant pass): applied only while that fill
  // is the last one.
  | { type: 'extendFill'; id: number; fieldsFor: FieldsFor }
  | { type: 'undoFill' };

/** The New contact sheet before anything is typed. */
export function initialNewContactDraftState(): NewContactDraftState {
  return { draft: contactDraft(), avatarUri: null, fill: null };
}

const EMPTY_DRAFT = contactDraft();
const isSame = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const pick = (from: Partial<ContactDraft>, fields: (keyof ContactDraft)[]): Partial<ContactDraft> =>
  Object.fromEntries(fields.map((field) => [field, from[field]]));

/**
 * The fill `fill` with more of it, from `fieldsFor` given the draft as if the fill hadn't happened (so
 * a place it brings takes the place of the fill's own). Taken only where the user changed nothing
 * since: a field the fill filled while it still holds the fill's value, any other while it is empty.
 */
function extendedFill(state: NewContactDraftState, fill: Fill, fieldsFor: FieldsFor): NewContactDraftState {
  const next = fieldsFor(draftWithChanges(state.draft, fill.fields, fill.after, fill.before));
  const taken = (Object.keys(next) as (keyof ContactDraft)[]).filter((field) =>
    isSame(state.draft[field], fill.fields.includes(field) ? fill.after[field] : EMPTY_DRAFT[field]),
  );
  if (taken.length === 0) return state;
  const added = taken.filter((field) => !fill.fields.includes(field));
  const values = pick(next, taken);
  return {
    ...state,
    draft: { ...state.draft, ...values },
    fill: {
      ...fill,
      fields: [...fill.fields, ...added],
      before: { ...fill.before, ...pick(state.draft, added) },
      after: { ...fill.after, ...values },
    },
  };
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
    case 'setIfEmpty':
      if (state.draft[action.field].trim()) return state;
      return { ...state, draft: { ...state.draft, [action.field]: action.value } };
    case 'avatar':
      return { ...state, avatarUri: action.uri };
    case 'fill': {
      const after = action.fieldsFor(state.draft);
      const fields = Object.keys(after) as (keyof ContactDraft)[];
      const photoUri = action.photoUri && state.avatarUri === null ? action.photoUri : null;
      if (fields.length === 0 && !photoUri) return state;
      return {
        draft: { ...state.draft, ...after },
        avatarUri: photoUri ?? state.avatarUri,
        fill: { id: action.id, source: action.source, fields, before: pick(state.draft, fields), after, photoUri },
      };
    }
    case 'extendFill':
      return state.fill?.id === action.id ? extendedFill(state, state.fill, action.fieldsFor) : state;
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
