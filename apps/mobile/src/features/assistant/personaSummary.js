const NOT_SET_UP = 'Not set up yet. Tell it about you and who follows you.';

/**
 * The "Writing as you" row's summary of a persona (null before the first save): the first sentence
 * of About you.
 */
export default function personaSummary(persona) {
  if (!persona) return NOT_SET_UP;
  const about = persona.aboutYou.trim();
  return about ? (/^[^\n]*?[.!?](?=\s|$)/.exec(about)?.[0] ?? about.split('\n')[0]) : NOT_SET_UP;
}
