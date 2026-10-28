import { ADMIN_INSTRUCTION_KINDS, INSTRUCTION_KINDS } from '@squidbox/shared';

import useHasFeature from '@/hooks/useHasFeature';

const MEMBER_KINDS = INSTRUCTION_KINDS.filter((kind) => !ADMIN_INSTRUCTION_KINDS.includes(kind));

/** The kinds of instructions this account sees, in the Instructions screen's order. */
export default function useInstructionKinds() {
  return useHasFeature('ai_admin') ? INSTRUCTION_KINDS : MEMBER_KINDS;
}
