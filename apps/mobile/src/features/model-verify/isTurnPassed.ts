import type { VerifyTurn } from '@squidbox/shared';

/** Whether a Verify turn passed: it got an answer, and every check of it passed. */
export default function isTurnPassed(turn: Pick<VerifyTurn, 'error' | 'checks'>): boolean {
  return turn.error === null && turn.checks.every((check) => check.ok);
}
