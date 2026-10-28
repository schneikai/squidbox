import { PERSONA_LIMITS } from '@squidbox/shared';

// Why addRule didn't add a rule (its result), as the chat's alert and the Rule sheet say it.
const addRuleText = {
  present: 'This rule is in Writing as you already.',
  tooLong: `A rule can have up to ${PERSONA_LIMITS.rule} characters.`,
  full: `Writing as you has up to ${PERSONA_LIMITS.rules} rules.`,
};

export default addRuleText;
