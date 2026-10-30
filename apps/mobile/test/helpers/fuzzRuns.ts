/**
 * How many seeded runs a fuzz test makes: `quick` in a plain run, `deep` under FUZZ_DEEP=1 (CI), and
 * FUZZ_SEEDS when set, to replay more or fewer while debugging.
 */
export function fuzzRuns(quick: number, deep: number): number {
  if (process.env.FUZZ_SEEDS) return Number(process.env.FUZZ_SEEDS);
  return process.env.FUZZ_DEEP ? deep : quick;
}
