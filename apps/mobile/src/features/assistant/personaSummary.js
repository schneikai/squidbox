import pluralizeText from '@/utils/pluralizeText';

const NOT_SET_UP = 'Not set up yet. Tell it about you and your fans.';

/**
 * The "Writing as you" row's summary of a persona (null before the first save): the first sentence
 * of About you, then how many rules and example posts it has, leaving out a count of 0.
 */
export default function personaSummary(persona) {
  if (!persona) return NOT_SET_UP;
  const about = persona.aboutYou.trim();
  const sentence = about ? (/^[^\n]*?[.!?](?=\s|$)/.exec(about)?.[0] ?? about.split('\n')[0]) : NOT_SET_UP;
  const counts = [
    persona.rules.length > 0 && pluralizeText('%{count} rule', '%{count} rules', persona.rules.length),
    persona.examplePosts.length > 0 &&
      pluralizeText('%{count} post to write like', '%{count} posts to write like', persona.examplePosts.length),
  ].filter(Boolean);
  return counts.length > 0 ? `${sentence}\n${counts.join(', ')}.` : sentence;
}
