import textLength from './textLength';
import type { VersionLimits } from './versionLimits';

// The share of the limit the text reaches before the counter shows (X starts its warning at 260 of 280).
const NEAR_LIMIT = 0.9;

export type TextLimit = { counter: string | null; isOver: boolean };

/**
 * A post's text against its version's limit (versionLimits): the counter beside it ("260 / 280", with
 * the channel the limit is of on a version of several: "281 / 280 · X"), null without a limit and
 * while the text is well short of it (under NEAR_LIMIT), and whether it is over (a warning, never a
 * block: the post saves as it is).
 */
export default function textLimit(
  limits: Pick<VersionLimits, 'maxTextLength' | 'textLimitOf'> | undefined,
  text: string,
): TextLimit {
  const max = limits?.maxTextLength;
  // UTF-16 units are never fewer than code points: a text this short is short enough uncounted.
  if (max == null || text.length < max * NEAR_LIMIT) return { counter: null, isOver: false };
  const length = textLength(text);
  if (length < max * NEAR_LIMIT) return { counter: null, isOver: false };
  const of = limits?.textLimitOf ? ` · ${limits.textLimitOf}` : '';
  return { counter: `${length} / ${max}${of}`, isOver: length > max };
}
