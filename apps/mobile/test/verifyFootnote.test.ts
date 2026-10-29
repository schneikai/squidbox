import { describe, expect, it } from 'vitest';

import { VISION_PLAN, WRITING_PLAN } from './helpers/verifyRuns';
import verifyFootnote from '../src/features/model-verify/verifyFootnote';

describe('verifyFootnote', () => {
  it("says what the kind's Verify does, with the plan's counts", () => {
    expect(verifyFootnote('writing', WRITING_PLAN)).toBe(
      'Verify plays 3 conversations, 9 turns in all. A judge reads each reply and says whether it did what was asked.',
    );
    expect(verifyFootnote('vision', VISION_PLAN)).toBe(
      'Verify sends 4 photos and checks that tags come back for each.',
    );
  });
});
