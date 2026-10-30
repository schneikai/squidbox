/** Every turn a Verify `run` has so far, section after section. */
export default function runTurns(run) {
  return run.result?.sections.flatMap((section) => section.turns) ?? [];
}
