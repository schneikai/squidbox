import type { Channel } from '@squidbox/shared';

import assetCountText from '@/utils/assets/assetCountText';

/**
 * A channel's rules in one line: "4 Assets · threads · 280 characters"; the parts it has no limit for
 * left out, null when none is left.
 */
export default function channelRulesText({ maxMedia, hasThreads, maxTextLength }: Channel): string | null {
  const parts = [
    maxMedia !== null && assetCountText(maxMedia),
    hasThreads && 'threads',
    maxTextLength !== null && `${maxTextLength.toLocaleString('en-US')} characters`,
  ].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(' · ') : null;
}
