import isPresent from '@/utils/isPresent';

// Emoji by explicit code-point ranges (pictographs and symbols, dingbats, flags), not
// \p{Extended_Pictographic}, whose Hermes support nothing in the app relies on yet.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

/**
 * "Fill it in for me": the next draft of Writing as you, from the server's `reply` to the `posts`
 * sent. About you, Tone and the content tags come from the reply; Use emoji is whether any sent post
 * has one; `pickedPosts` are the sent posts the reply picked, verbatim, which Save adds to
 * Favorites. The rules stay as they are (a model would invent them). Posts sent from Favorites
 * (`isFromFavorites`: the library has none) are in Favorites already, so none are picked then.
 * `mode` `'empty'` fills only the empty fields of `draft` (Use emoji only while nothing is picked,
 * as it copies how the picked posts use emoji), `'replace'` replaces all of these.
 */
export default function applyPersonaDraft(draft, reply, posts, mode, isFromFavorites = false) {
  const drafted = {
    aboutYou: reply.aboutYou,
    tone: reply.tone,
    useEmoji: posts.some((post) => EMOJI.test(post)),
    contentTags: reply.contentTags,
    ...(!isFromFavorites && {
      pickedPosts: reply.examplePostIndexes.map((index) => posts[index]).filter(Boolean),
    }),
  };
  if (mode === 'replace') return { ...draft, ...drafted };
  const next = { ...draft };
  for (const [field, value] of Object.entries(drafted)) {
    if (!isPresent(draft[field === 'useEmoji' ? 'pickedPosts' : field])) next[field] = value;
  }
  return next;
}
