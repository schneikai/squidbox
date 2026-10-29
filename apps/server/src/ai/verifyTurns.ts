// The turns of a Verify as they grow (chatVerify.ts, tagVerify.ts): the result with its totals,
// a turn without a reply, and the timing of a model's call.
import type { VerifyPost, VerifyResult, VerifySection, VerifyTurn } from '@squidbox/shared';
import { errorMessage } from '../errors.js';
import { VeniceUnavailableError } from './venice.js';
import type { VerifyOptions } from './verify.js';

/** A Verify run that stopped because Venice didn't answer: its message, and the turns before. */
export class VerifyStopped extends Error {
  constructor(
    message: string,
    readonly result: VerifyResult,
  ) {
    super(message);
    this.name = 'VerifyStopped';
  }
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** The sections with their totals, so a partial result is complete in itself. */
export function withTotals(sections: VerifySection[]): VerifyResult {
  const turns = sections.flatMap((section) => section.turns);
  const checks = turns.flatMap((turn) => turn.checks);
  const seconds = turns.flatMap((turn) => (turn.seconds === null ? [] : [turn.seconds]));
  return {
    sections,
    passes: checks.filter((check) => check.ok).length,
    fails: checks.filter((check) => !check.ok).length,
    unreadable: turns.filter((turn) => turn.unreadable).length,
    medianSeconds: median(seconds),
    slowestSeconds: Math.max(0, ...seconds),
  };
}

/**
 * A Verify's result as it grows: `section` opens one, `add` appends a turn and tells `onTurn`, and
 * `untilStopped` runs the turns and answers the result, or rejects with VerifyStopped (the result so
 * far) when Venice stops answering.
 */
export function verifyProgress(onTurn: VerifyOptions['onTurn']) {
  const sections: VerifySection[] = [];
  let turnsDone = 0;
  return {
    section(id: string, title: string, systemMessage: string | null, post: VerifyPost | null): VerifySection {
      const section = { id, title, systemMessage, post, turns: [] };
      sections.push(section);
      return section;
    },
    async add(section: VerifySection, turn: VerifyTurn): Promise<void> {
      section.turns.push(turn);
      turnsDone++;
      await onTurn?.(withTotals(sections), turnsDone);
    },
    async untilStopped(turns: () => Promise<void>): Promise<VerifyResult> {
      try {
        await turns();
      } catch (error) {
        if (error instanceof VeniceUnavailableError) throw new VerifyStopped(error.message, withTotals(sections));
        throw error;
      }
      return withTotals(sections);
    },
  };
}

/** A turn with no reply: `error` says why, and each of the `expected` checks counts as failed. */
export function missedTurn(turn: Pick<VerifyTurn, 'prompt' | 'note'>, error: string, expected: string[]): VerifyTurn {
  return {
    ...turn,
    seconds: null,
    unreadable: false,
    reply: null,
    items: [],
    checks: expected.map((name) => ({ name, ok: false, reason: null })),
    error,
  };
}

/**
 * The model's call timed, or its error's message: what the model answered wrong (a VeniceError or
 * anything else). Venice not answering (VeniceUnavailableError) is thrown on: it stops the Verify.
 */
export async function timedCall<T>(call: () => Promise<T>): Promise<{ value: T; seconds: number } | { error: string }> {
  const started = Date.now();
  try {
    const value = await call();
    return { value, seconds: (Date.now() - started) / 1000 };
  } catch (error) {
    if (error instanceof VeniceUnavailableError) throw error;
    return { error: errorMessage(error) };
  }
}
