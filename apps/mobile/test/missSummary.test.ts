import { describe, expect, it } from 'vitest';

import { DONE_ONE_MISS, missedTurn, VISION_DONE, VISION_PLAN, WRITING_PLAN } from './helpers/verifyRuns';
import missSummary from '../src/features/model-verify/missSummary';

describe('missSummary', () => {
  it("names a single miss's reason and conversation", () => {
    expect(missSummary(DONE_ONE_MISS.result!, WRITING_PLAN, 'writing')).toBe(
      'Missed once: made up a detail in Changes on request.',
    );
  });

  it('counts several misses and names their conversations', () => {
    const result = DONE_ONE_MISS.result!;
    const sections = result.sections.map((section) =>
      section.id === 'refine' ? section : { ...section, turns: [missedTurn(), ...section.turns.slice(1)] },
    );
    expect(missSummary({ ...result, sections }, WRITING_PLAN, 'writing')).toBe(
      'Missed 3 turns, in Talk first, then posts, Changes on request and Captions, bios and back.',
    );
  });

  it('says every reply or photo passed', () => {
    const clean = { ...DONE_ONE_MISS.result!, sections: DONE_ONE_MISS.result!.sections.slice(0, 1) };
    expect(missSummary(clean, WRITING_PLAN, 'writing')).toBe('Every reply did what was asked.');
    expect(missSummary(VISION_DONE.result!, VISION_PLAN, 'vision')).toBe(
      'Every photo came back with tags. Compare shows how good they are.',
    );
  });
});
