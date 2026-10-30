import { VERIFY_JUDGE_MODEL_ID } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import { VISION_PLAN } from './helpers/verifyRuns';
import verifyEstimate from '../src/features/model-verify/verifyEstimate';

const model = (costPerReplyUsd: number, costPer100PhotosUsd: number | null = null) => ({
  id: 'm',
  costPerReplyUsd,
  costPer100PhotosUsd,
});
// 21 turns, as the writing Verify plays
const PLAN = { sections: [{ id: 'a', title: 'A', prompts: Array.from({ length: 21 }, () => 'Hi') }] };
const withJudge = (costPerReplyUsd: number) => [{ ...model(costPerReplyUsd), id: VERIFY_JUDGE_MODEL_ID }];

const costText = (...args: Parameters<typeof verifyEstimate>) => verifyEstimate(...args).costText;

describe('verifyEstimate', () => {
  it("adds the judge's replies to a writing run's, in cents below a dollar", () => {
    // 21 × (0.004 + 0.006) = 0.21
    expect(costText('writing', PLAN, model(0.004), withJudge(0.006))).toBe('about 21¢');
    // 21 × (0.0004 + 0.004) = 0.0924
    expect(costText('writing', PLAN, model(0.0004), withJudge(0.004))).toBe('about 9.2¢');
  });

  it('says under 1¢ for less, and dollars from one up', () => {
    expect(costText('writing', PLAN, model(0.0001), null)).toBe('under 1¢');
    expect(costText('writing', PLAN, model(0.03), withJudge(0.027143))).toBe('about $1.20');
  });

  it("costs a vision run its plan's photos", () => {
    // 4 × 0.5 / 100 = 0.02
    expect(costText('vision', VISION_PLAN, model(0, 0.5), null)).toBe('about 2¢');
  });

  it("names the plan's turns and the judge, null while it isn't in the catalog", () => {
    const judges = withJudge(0.006);
    expect(verifyEstimate('writing', PLAN, model(0.004), judges)).toMatchObject({ turns: 21, judge: judges[0] });
    expect(verifyEstimate('writing', PLAN, model(0.004), null).judge).toBeNull();
  });
});
