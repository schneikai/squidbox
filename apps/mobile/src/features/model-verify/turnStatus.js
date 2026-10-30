import isTurnPassed from './isTurnPassed';

/**
 * A Verify turn's VerifyStatusIcon status: passed or missed once it's in (`turn`), else running when
 * it is the one under way (`isRunning`), waiting otherwise.
 */
export default function turnStatus(turn, isRunning) {
  if (turn) return isTurnPassed(turn) ? 'passed' : 'missed';
  return isRunning ? 'running' : 'waiting';
}
