import { PERSONA_LIMITS } from '@squidbox/shared';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import TextButton from '@/components/TextButton';
import { Row, Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';

/**
 * Rules: one row each, a tap opens it (`onOpen(index)`), and "Add a rule" (`onAdd`) while there is
 * room for one more.
 */
function RulesField({ rules, onOpen, onAdd }) {
  const canAdd = rules.length < PERSONA_LIMITS.rules;

  return (
    <Section>
      {rules.map((rule, index) => (
        // Keyed by index: two rules can be the same.
        <Row key={index} label={rule} onPress={() => onOpen(index)} chevron />
      ))}
      {canAdd && (
        <View style={styles.add}>
          <TextButton icon="add" label="Add a rule" onPress={onAdd} />
        </View>
      )}
    </Section>
  );
}

export default memo(RulesField);

const styles = StyleSheet.create({
  // The button's own inset is wider than the rows', so its icon lines up with their text.
  add: {
    alignItems: 'flex-start',
    marginLeft: SCREEN_PADDING - 24,
  },
});
