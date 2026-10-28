// The model checks, one per kind (chatCheck.ts for writing, tagCheck.ts for vision), and the shape
// they share; checkTurns.ts builds their results. The CLI (scripts/check-models.ts) and the server's
// job (modelChecks.ts) run them through CHECKS.
import type { AiModelKind, Instructions, ModelCheckResult } from '@squidbox/shared';
import type { CatalogEntry } from './catalog.js';
import { checkChatModel, CHAT_SECTION_IDS } from './chatCheck.js';
import { checkTaggingModel, TAG_SECTION_IDS } from './tagCheck.js';

export type CheckOptions = {
  // Venice's models, where the chat check finds its judge
  catalog: CatalogEntry[];
  // the texts the check briefs the model and the judge with
  instructions: Instructions;
  // after each turn, with the result so far
  onTurn?: (result: ModelCheckResult, turnsDone: number) => Promise<void> | void;
  // the sections to run (the CLI's --scenario), all when left out
  sectionIds?: string[];
};

/** Runs one kind's check on a model; rejects only when the check can't run at all. */
export type CheckRunner = (model: CatalogEntry, options: CheckOptions) => Promise<ModelCheckResult>;

/** Each kind's check: its runner and its sections (a whole run has CHECK_TURNS[kind] turns, in shared). */
export const CHECKS: Record<AiModelKind, { run: CheckRunner; sectionIds: string[] }> = {
  writing: { run: checkChatModel, sectionIds: CHAT_SECTION_IDS },
  vision: { run: checkTaggingModel, sectionIds: TAG_SECTION_IDS },
};
