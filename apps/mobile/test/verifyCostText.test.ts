import { VERIFY_JUDGE_MODEL_ID } from '@squidbox/shared';
import { describe, expect, it } from 'vitest';

import { VISION_PLAN } from './helpers/verifyRuns';
import verifyCostText from '../src/features/model-verify/verifyCostText';

const model = (costPerReplyUsd: number, costPer100PhotosUsd: number | null = null) => ({
  id: 'm',
  costPerReplyUsd,
  costPer100PhotosUsd,
});
// 21 turns, as the writing Verify plays
const PLAN = { sections: [{ id: 'a', title: 'A', prompts: Array.from({ length: 21 }, () => 'Hi') }] };
const withJudge = (costPerReplyUsd: number) => [{ ...model(costPerReplyUsd), id: VERIFY_JUDGE_MODEL_ID }];

describe('verifyCostText', () => {
  it("adds the judge's replies to a writing run's, in cents below a dollar", () => {
    // 21 × (0.004 + 0.006) = 0.21
    expect(verifyCostText('writing', PLAN, model(0.004), withJudge(0.006))).toBe('about 21¢');
    // 21 × (0.0004 + 0.004) = 0.0924
    expect(verifyCostText('writing', PLAN, model(0.0004), withJudge(0.004))).toBe('about 9.2¢');
  });

  it('says under 1¢ for less, and dollars from one up', () => {
    expect(verifyCostText('writing', PLAN, model(0.0001), null)).toBe('under 1¢');
    expect(verifyCostText('writing', PLAN, model(0.03), withJudge(0.027143))).toBe('about $1.20');
  });

  it("costs a vision run its plan's photos", () => {
    // 4 × 0.5 / 100 = 0.02
    expect(verifyCostText('vision', VISION_PLAN, model(0, 0.5), null)).toBe('about 2¢');
  });
});
