/**
 * The collections the two-device fuzz (twoDeviceFuzz.e2e) writes and checks, and those it leaves out
 * with why. fuzzCoverage.test holds the two to the registry, so a new collection is a choice.
 */
export const fuzzedCollections = ['assets', 'album_assets', 'contacts', 'contact_list_members', 'contact_links'];

const PLAIN = 'not yet: a plain record, merged per field like contacts';
const PER_USER = 'not yet: one record per account (userRecord), whose first save is its own path';

export const notFuzzed: Record<string, string> = {
  albums: `seeded, not edited; ${PLAIN}`,
  contact_lists: `seeded, not edited; ${PLAIN}`,
  posts: PLAIN,
  prompt_buttons: PLAIN,
  favorites: PLAIN,
  post_assets: 'not yet: the edge repository album_assets uses',
  personas: PER_USER,
  instructions: PER_USER,
  model_choices: PER_USER,
  contact_settings: PER_USER,
  idea_settings: PER_USER,
};
