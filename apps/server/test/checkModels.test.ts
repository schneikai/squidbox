import { describe, expect, it } from 'vitest';
import type { ModelCheckResult } from '@squidbox/shared';
import { parseArgs, renderModel } from '../scripts/check-models.js';

describe('parseArgs', () => {
  it('defaults to the writing check with every scenario', () => {
    expect(parseArgs(['kimi-k3', '--out', '/tmp/k.md'])).toEqual({
      kind: 'writing',
      models: ['kimi-k3'],
      sections: undefined,
      out: '/tmp/k.md',
    });
    expect(parseArgs(['kimi-k3', '--scenario', 'talk']).sections).toEqual(['talk']);
  });

  it('takes --kind vision, and refuses a scenario with it or an unknown one', () => {
    expect(parseArgs(['--kind', 'vision', 'gemma-4-uncensored'])).toMatchObject({
      kind: 'vision',
      models: ['gemma-4-uncensored'],
    });
    expect(() => parseArgs(['--kind', 'vision', 'gemma-4-uncensored', '--scenario', 'talk'])).toThrow(
      '--scenario is only for --kind writing',
    );
    expect(() => parseArgs(['kimi-k3', '--scenario', 'nope'])).toThrow('No scenario nope');
    expect(() => parseArgs(['--kind', 'audio', 'x'])).toThrow();
  });
});

describe('renderModel', () => {
  const result: ModelCheckResult = {
    sections: [
      {
        id: 'talk',
        title: 'Talk first',
        systemMessage: 'You are the writing assistant.',
        turns: [
          {
            prompt: 'nice, create some posts',
            note: '{"caption":"Rain."}',
            seconds: 2.34,
            unreadable: false,
            reply: 'Here you go.',
            items: ['First post', 'Second\npost'],
            checks: [
              { name: 'cards:2', ok: true, reason: null },
              { name: 'judge', ok: false, reason: 'Changed the subject.' },
            ],
            error: null,
          },
          {
            prompt: 'make them shorter',
            note: null,
            seconds: null,
            unreadable: false,
            reply: null,
            items: [],
            checks: [{ name: 'shorter', ok: false, reason: null }],
            error: 'Model is busy',
          },
        ],
      },
    ],
    passes: 1,
    fails: 2,
    unreadable: 0,
    medianSeconds: 2.34,
    slowestSeconds: 2.34,
  };

  it('writes the turns with the replies, the items and the checks', () => {
    const text = renderModel('kimi-k3', result).join('\n');
    expect(text).toContain('## kimi-k3');
    expect(text).toContain('### talk: Talk first');
    expect(text).toContain('<details><summary>System message</summary>');
    expect(text).toContain('*The editor changed the post: {"caption":"Rain."}*');
    expect(text).toContain('> nice, create some posts');
    expect(text).toContain('*2.3 s*');
    expect(text).toContain('    Here you go.');
    expect(text).toContain('1. First post\n2. Second / post');
    expect(text).toContain('PASS cards:2 · **FAIL** judge (Changed the subject.)');
    expect(text).toContain('**Error:** Model is busy');
  });
});
