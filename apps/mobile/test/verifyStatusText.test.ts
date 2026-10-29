import { describe, expect, it } from 'vitest';

import { DONE_ONE_MISS, RUNNING, STOPPED, VISION_DONE } from './helpers/verifyRuns';
import verifyStatusText from '../src/features/model-verify/verifyStatusText';

describe('verifyStatusText', () => {
  it("says the latest run's state", () => {
    expect(verifyStatusText(null)).toBe('Not verified yet');
    expect(verifyStatusText(RUNNING)).toBe('Verifying… 5 of 9');
    expect(verifyStatusText(DONE_ONE_MISS)).toBe('Passed 8 of 9');
    expect(verifyStatusText(STOPPED)).toBe('Verify stopped');
    expect(verifyStatusText(VISION_DONE)).toBe('Passed 4 of 4');
  });
});
