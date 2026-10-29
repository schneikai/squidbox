import type { VerifyPlan, VerifyRun, VerifyTurn } from '@squidbox/shared';

/** Canned Verify plans and runs for the model-verify helpers' tests. */

// A writing plan of three sections (4 + 2 + 3 turns) and a vision one of four photos.
export const WRITING_PLAN: VerifyPlan = {
  sections: [
    { id: 'talk', title: 'Talk first, then posts', prompts: ['a', 'b', 'c', 'd'] },
    { id: 'refine', title: 'Changes on request', prompts: ['e', 'f'] },
    { id: 'switch', title: 'Captions, bios and back', prompts: ['g', 'h', 'i'] },
  ],
};
export const VISION_PLAN: VerifyPlan = {
  sections: [{ id: 'photos', title: 'Photo tags', prompts: ['10.jpg', '13.jpg', '15.jpg', '19.jpg'] }],
};

export function passedTurn(): VerifyTurn {
  return {
    prompt: 'p',
    note: null,
    seconds: 0.8,
    unreadable: false,
    reply: 'Sure.',
    items: [],
    checks: [{ name: 'judge', ok: true, reason: 'Answered it.' }],
    error: null,
  };
}

export function missedTurn(reason = 'made up a detail'): VerifyTurn {
  return {
    ...passedTurn(),
    checks: [
      { name: 'cards:3', ok: false, reason: 'expected 3 posts, got 1' },
      { name: 'judge', ok: false, reason },
    ],
  };
}

const turns = (count: number, make = passedTurn) => Array.from({ length: count }, () => make());

function run(
  status: VerifyRun['status'],
  sections: { id: string; turns: VerifyTurn[] }[],
  turnsTotal: number,
  kind: VerifyRun['kind'] = 'writing',
  error: string | null = null,
): VerifyRun {
  const all = sections.flatMap((section) => section.turns);
  return {
    id: 'r1',
    kind,
    modelId: 'm',
    status,
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    finishedAt: status === 'running' ? null : new Date().toISOString(),
    turnsDone: all.length,
    turnsTotal,
    result: {
      sections: sections.map((section) => ({ ...section, title: section.id, systemMessage: null, post: null })),
      passes: 0,
      fails: 0,
      unreadable: 0,
      medianSeconds: 1.8,
      slowestSeconds: 3,
    },
    error,
  };
}

// Running: talk done, refine one turn in.
export const RUNNING = run(
  'running',
  [
    { id: 'talk', turns: turns(4) },
    { id: 'refine', turns: turns(1) },
  ],
  9,
);

// Done with one miss, in refine.
export const DONE_ONE_MISS = run(
  'done',
  [
    { id: 'talk', turns: turns(4) },
    { id: 'refine', turns: [passedTurn(), missedTurn()] },
    { id: 'switch', turns: turns(3) },
  ],
  9,
);

// Stopped at turn 7 of 9: talk and refine done, switch one turn in.
export const STOPPED = run(
  'stopped',
  [
    { id: 'talk', turns: turns(4) },
    { id: 'refine', turns: turns(2) },
    { id: 'switch', turns: turns(1) },
  ],
  9,
  'writing',
  'Venice is down for the test',
);

// A vision run, every photo passed.
export const VISION_DONE = run('done', [{ id: 'photos', turns: turns(4) }], 4, 'vision');
