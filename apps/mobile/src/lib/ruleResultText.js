import { PERSONA_LIMITS } from '@squidbox/shared';

// Why addRule or updateRule didn't write a rule (its result), as the chat's alert and the Rule sheet
// say it.
const ruleResultText = {
  present: 'This rule is in your Rules already.',
  tooLong: `A rule can have up to ${PERSONA_LIMITS.rule} characters.`,
  full: `You can have up to ${PERSONA_LIMITS.rules} rules.`,
};

export default ruleResultText;
