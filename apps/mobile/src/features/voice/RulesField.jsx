import { PERSONA_LIMITS } from '@squidbox/shared';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import useEditableList from './useEditableList';

import IconButton from '@/components/IconButton';
import TextButton from '@/components/TextButton';
import TextInput from '@/components/TextInput';
import { Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import { colors, sizes } from '@/styles/designTokens';

/**
 * Rules: one row each, edited in place, × takes it out. "Add a rule" adds an empty row and focuses
 * it; empty rows are dropped on Save, not while typing. `onChange(rules)` gets the whole list.
 */
function RulesField({ rules, onChange, placeholder }) {
  const list = useEditableList(rules, onChange);

  const canAdd = rules.length < PERSONA_LIMITS.rules;

  return (
    <Section>
      {rules.map((rule, index) => (
        // Keyed by index: a rule's text changes with every keystroke, and two can be the same.
        <View key={index} style={styles.row}>
          <TextInput
            value={rule}
            onChangeText={(text) => list.change(index, text)}
            placeholder={placeholder}
            maxLength={PERSONA_LIMITS.rule}
            autoFocus={list.isAdded(index)}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            style={styles.input}
          />
          <IconButton
            icon="close"
            size={sizes.iconSmall}
            color={colors.text.secondary}
            onPress={() => list.remove(index)}
            accessibilityLabel="Remove this rule"
          />
        </View>
      ))}
      {canAdd && (
        <View style={styles.add}>
          <TextButton icon="add" label="Add a rule" onPress={list.add} />
        </View>
      )}
    </Section>
  );
}

export default memo(RulesField);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SCREEN_PADDING,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
  },
  // The button's own inset is wider than the rows', so its icon lines up with their text.
  add: {
    alignItems: 'flex-start',
    marginLeft: SCREEN_PADDING - 24,
  },
});
