import pluralizeText from '@/utils/pluralizeText';

const NOT_SET_UP = 'Not set up yet. Tell it about you and who follows you.';

/**
 * The "Writing as you" row's summary of a persona (null before the first save): the first sentence
 * of About you, then how many rules it has, unless none.
 */
export default function personaSummary(persona) {
  if (!persona) return NOT_SET_UP;
  const about = persona.aboutYou.trim();
  const sentence = about ? (/^[^\n]*?[.!?](?=\s|$)/.exec(about)?.[0] ?? about.split('\n')[0]) : NOT_SET_UP;
  if (persona.rules.length === 0) return sentence;
  return `${sentence}\n${pluralizeText('%{count} rule', '%{count} rules', persona.rules.length)}.`;
}
