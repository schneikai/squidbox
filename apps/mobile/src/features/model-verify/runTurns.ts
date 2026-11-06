import type { VerifyRun, VerifyTurn } from '@squidbox/shared';

/** Every turn a Verify `run` has so far, section after section. */
export default function runTurns(run: VerifyRun): VerifyTurn[] {
  return run.result?.sections.flatMap((section) => section.turns) ?? [];
}
