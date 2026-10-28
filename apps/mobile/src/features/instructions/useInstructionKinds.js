import { INSTRUCTION_KINDS } from '@squidbox/shared';

import useHasFeature from '@/hooks/useHasFeature';

// Kinds only an ai_admin account's tools send: the model check's judge.
const ADMIN_KINDS = new Set(['modelCheckJudge']);
const MEMBER_KINDS = INSTRUCTION_KINDS.filter((kind) => !ADMIN_KINDS.has(kind));

/** The kinds of instructions this account sees, in the Instructions screen's order. */
export default function useInstructionKinds() {
  return useHasFeature('ai_admin') ? INSTRUCTION_KINDS : MEMBER_KINDS;
}
