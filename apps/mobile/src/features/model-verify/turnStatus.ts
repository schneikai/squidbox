import type { VerifyTurn } from '@squidbox/shared';

import type { VerifyStatus } from './VerifyStatusIcon';
import isTurnPassed from './isTurnPassed';

/**
 * A Verify turn's VerifyStatusIcon status: passed or missed once it's in (`turn`), else running when
 * it is the one under way (`isRunning`), waiting otherwise.
 */
export default function turnStatus(turn: VerifyTurn | null, isRunning: boolean): VerifyStatus {
  if (turn) return isTurnPassed(turn) ? 'passed' : 'missed';
  return isRunning ? 'running' : 'waiting';
}
