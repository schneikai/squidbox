// Verify, one per kind (chatVerify.ts for writing, tagVerify.ts for vision), and the shape they
// share; verifyTurns.ts builds their results. The CLI (scripts/verify-models.ts) and the server's
// job (verifyRuns.ts) run them through VERIFY.
import type { AiModelKind, Instructions, VerifyPlan, VerifyResult } from '@squidbox/shared';
import type { CatalogEntry } from './catalog.js';
import { CHAT_PLAN, verifyChatModel } from './chatVerify.js';
import { TAG_PLAN, verifyTaggingModel } from './tagVerify.js';

export type VerifyOptions = {
  // Venice's models, where the writing Verify finds its judge
  catalog: CatalogEntry[];
  // the texts Verify briefs the model and the judge with
  instructions: Instructions;
  // after each turn, with the result so far
  onTurn?: (result: VerifyResult, turnsDone: number) => Promise<void> | void;
  // the sections to run (the CLI's --scenario), all when left out
  sectionIds?: string[];
};

/**
 * Runs one kind's Verify on a model. Rejects with VerifyStopped (verifyTurns.ts, the result so far
 * with it) when Venice stops answering, and with a plain error when it can't run at all.
 */
export type VerifyRunner = (model: CatalogEntry, options: VerifyOptions) => Promise<VerifyResult>;

/** Each kind's Verify: its runner and its plan (verifyPlanTurns counts a whole run's turns). */
export const VERIFY: Record<AiModelKind, { run: VerifyRunner; plan: VerifyPlan }> = {
  writing: { run: verifyChatModel, plan: CHAT_PLAN },
  vision: { run: verifyTaggingModel, plan: TAG_PLAN },
};
