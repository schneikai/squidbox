import isPresent from '@/utils/isPresent';

/**
 * "Fill it in for me": the next draft of Writing as you, from the server's `reply` to the `posts`
 * sent. About you, Tone and the content tags come from the reply; `pickedPosts` are the sent posts
 * the reply picked, verbatim, which Save adds to Favorites. The rules stay as they are (a model would invent them). Posts sent from Favorites
 * (`isFromFavorites`: the library has none) are in Favorites already, so none are picked then.
 * `mode` `'empty'` fills only the empty fields of `draft`, `'replace'` replaces all of these.
 */
export default function applyPersonaDraft(draft, reply, posts, mode, isFromFavorites = false) {
  const drafted = {
    aboutYou: reply.aboutYou,
    tone: reply.tone,
    contentTags: reply.contentTags,
    ...(!isFromFavorites && {
      pickedPosts: reply.examplePostIndexes.map((index) => posts[index]).filter(Boolean),
    }),
  };
  if (mode === 'replace') return { ...draft, ...drafted };
  const next = { ...draft };
  for (const [field, value] of Object.entries(drafted)) {
    if (!isPresent(draft[field])) next[field] = value;
  }
  return next;
}
