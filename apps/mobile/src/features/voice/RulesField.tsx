import { PERSONA_LIMITS, type PersonaRecord } from '@squidbox/shared';
import { memo } from 'react';

import AddRow from '@/components/settings-list/AddRow';
import { Row, Section } from '@/components/settings-list/SettingsList';

export type RulesFieldProps = { rules: PersonaRecord['rules']; onOpen: (index: number) => void; onAdd: () => void };

/**
 * Rules: one row each, a tap opens it (`onOpen(index)`), and "Add a rule" (`onAdd`) while there is
 * room for one more.
 */
function RulesField({ rules, onOpen, onAdd }: RulesFieldProps) {
  const canAdd = rules.length < PERSONA_LIMITS.rules;

  return (
    <Section>
      {rules.map((rule, index) => (
        // Keyed by index: two rules can be the same.
        <Row key={index} label={rule} onPress={() => onOpen(index)} hasChevron />
      ))}
      {canAdd && <AddRow label="Add a rule" onPress={onAdd} />}
    </Section>
  );
}

export default memo(RulesField);
