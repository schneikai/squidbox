import type { Channel } from '@squidbox/shared';

/**
 * A channel's rules in one line: "4 media · threads · 280 characters"; the parts it has no limit for
 * left out, null when none is left.
 */
export default function channelRulesText({ maxMedia, hasThreads, maxTextLength }: Channel): string | null {
  const parts = [
    maxMedia !== null && `${maxMedia.toLocaleString('en-US')} media`,
    hasThreads && 'threads',
    maxTextLength !== null && `${maxTextLength.toLocaleString('en-US')} characters`,
  ].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(' · ') : null;
}
