import {
  type ContactDraft,
  type FillSource,
  contactDraft,
  draftWithChanges,
} from '@/features/contact-detail/contactFields';

// A fill from a screenshot or an X profile: its `id`, who started it (`source`, for its note), the
// fields it filled and who filled each (`fieldSources`: From link's assistant pass adds to a link's
// fill), their values before it and what it put in them, and the photo it brought (a fill never
// replaces one, so there was none before it).
export type Fill = {
  id: number;
  source: FillSource;
  fields: (keyof ContactDraft)[];
  fieldSources: Partial<Record<keyof ContactDraft, FillSource>>;
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
  // is taken only while no photo is set. Recorded even when it fills nothing, so its later parts
  // (extendFill) have it.
  | { type: 'fill'; id: number; source: FillSource; fieldsFor: FieldsFor; photoUri?: string }
  // More for fill `id` that came later, by `source`, applied only while that fill is the last one
  // (extendedFill).
  | {
      type: 'extendFill';
      id: number;
      source: FillSource;
      fieldsFor: FieldsFor;
      photoUri?: string;
      onlyIntoEmpty?: boolean;
    }
  | { type: 'undoFill' };

const EMPTY_DRAFT = contactDraft();
const isSame = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const pick = (from: Partial<ContactDraft>, fields: (keyof ContactDraft)[]): Partial<ContactDraft> =>
  Object.fromEntries(fields.map((field) => [field, from[field]]));
const sourcesOf = (fields: (keyof ContactDraft)[], source: FillSource) =>
  Object.fromEntries(fields.map((field) => [field, source])) as Fill['fieldSources'];

/**
 * `fill` with more of it, by `source`: what `fieldsFor` returns for the draft as if the fill hadn't
 * happened (so a place it brings takes the place of the fill's own), and `photoUri` while no photo is
 * set. A field the fill filled is taken only while it still holds the fill's value; any other as
 * `fieldsFor` says, or with `onlyIntoEmpty` (the assistant's later pass) only while it is empty.
 */
function extendedFill(
  state: NewContactDraftState,
  fill: Fill,
  { source, fieldsFor, photoUri, onlyIntoEmpty = false }: Extract<NewContactDraftAction, { type: 'extendFill' }>,
): NewContactDraftState {
  const next = fieldsFor(draftWithChanges(state.draft, fill.fields, fill.after, fill.before));
  const taken = (Object.keys(next) as (keyof ContactDraft)[]).filter((field) => {
    if (fill.fields.includes(field)) return isSame(state.draft[field], fill.after[field]);
    return !onlyIntoEmpty || isSame(state.draft[field], EMPTY_DRAFT[field]);
  });
  const photo = photoUri && state.avatarUri === null && fill.photoUri === null ? photoUri : null;
  if (taken.length === 0 && !photo) return state;
  const added = taken.filter((field) => !fill.fields.includes(field));
  const values = pick(next, taken);
  return {
    draft: { ...state.draft, ...values },
    avatarUri: photo ?? state.avatarUri,
    fill: {
      ...fill,
      fields: [...fill.fields, ...added],
      fieldSources: { ...fill.fieldSources, ...sourcesOf(taken, source) },
      before: { ...fill.before, ...pick(state.draft, added) },
      after: { ...fill.after, ...values },
      photoUri: photo ?? fill.photoUri,
    },
  };
}

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
          id: action.id,
          source: action.source,
          fields,
          fieldSources: sourcesOf(fields, action.source),
          before: pick(state.draft, fields),
          after,
          photoUri,
        },
      };
    }
    case 'extendFill':
      return state.fill?.id === action.id ? extendedFill(state, state.fill, action) : state;
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
