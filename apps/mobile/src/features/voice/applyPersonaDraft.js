// Emoji by explicit code-point ranges (pictographs and symbols, dingbats, flags), not
// \p{Extended_Pictographic}, whose Hermes support nothing in the app relies on yet.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

/**
 * "Fill it in for me": the next draft of Writing as you, from the server's `reply` to the `posts`
 * sent. About you, the content tags and Tone come from the reply; the example posts are the sent
 * posts it picked, verbatim, so nothing is made up; Use emoji is whether any sent post has one.
 * The rules stay as they are (a model would invent them). `mode` `'empty'` fills only the empty
 * fields of `draft` (Use emoji with the example posts, as it copies how they use emoji), `'replace'`
 * replaces all of these.
 */
export default function applyPersonaDraft(draft, reply, posts, mode) {
  const drafted = {
    aboutYou: reply.aboutYou,
    contentTags: reply.contentTags,
    tone: reply.tone,
    examplePosts: reply.examplePostIndexes.map((index) => posts[index]).filter(Boolean),
    useEmoji: posts.some((post) => EMOJI.test(post)),
  };
  if (mode === 'replace') return { ...draft, ...drafted };
  const next = { ...draft };
  for (const [field, value] of Object.entries(drafted)) {
    if (field === 'useEmoji' ? !isPersonaFieldFilled(draft, 'examplePosts') : !isPersonaFieldFilled(draft, field)) {
      next[field] = value;
    }
  }
  return next;
}

/** Whether a field of the draft holds something (a list with items, text that isn't blank). */
export function isPersonaFieldFilled(draft, field) {
  const value = draft[field];
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? value.trim() !== '' : false;
}
