// The turns of a model check as they grow (chatCheck.ts, tagCheck.ts): the result with its totals,
// a turn without a reply, and the timing of a model's call.
import type { ModelCheckResult, ModelCheckSection, ModelCheckTurn } from '@squidbox/shared';
import { errorMessage } from '../errors.js';
import type { CheckOptions } from './modelCheck.js';

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** The sections with their totals, so a partial result is complete in itself. */
export function withTotals(sections: ModelCheckSection[]): ModelCheckResult {
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

/** A check's result as it grows: `section` opens one, `add` appends a turn and tells `onTurn`. */
export function checkProgress(onTurn: CheckOptions['onTurn']) {
  const sections: ModelCheckSection[] = [];
  let turnsDone = 0;
  return {
    section(id: string, title: string, systemMessage: string | null): ModelCheckSection {
      const section = { id, title, systemMessage, turns: [] };
      sections.push(section);
      return section;
    },
    async add(section: ModelCheckSection, turn: ModelCheckTurn): Promise<void> {
      section.turns.push(turn);
      turnsDone++;
      await onTurn?.(withTotals(sections), turnsDone);
    },
    result: () => withTotals(sections),
  };
}

/** A turn with no reply: `error` says why, and each of the `expected` checks counts as failed. */
export function failedTurn(
  turn: Pick<ModelCheckTurn, 'prompt' | 'note'>,
  error: string,
  expected: string[],
): ModelCheckTurn {
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

/** The model's call timed, or its error's message (a VeniceError or anything else). */
export async function timedCall<T>(call: () => Promise<T>): Promise<{ value: T; seconds: number } | { error: string }> {
  const started = Date.now();
  try {
    const value = await call();
    return { value, seconds: (Date.now() - started) / 1000 };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
