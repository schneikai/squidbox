import { PERSONA_LIMITS } from '@squidbox/shared';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';
import TextInput from '@/components/TextInput';
import { Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import { colors, sizes, typography } from '@/styles/designTokens';

/**
 * Rules: one row each, edited in place, × takes it out. "Add a rule" adds an empty row and focuses
 * it; empty rows are dropped on Save, not while typing. `onChange(rules)` gets the whole list.
 */
export default function RulesField({ rules, onChange, placeholder }) {
  // The row Add just made, which takes the focus once.
  const [addedIndex, setAddedIndex] = useState(null);

  const canAdd = rules.length < PERSONA_LIMITS.rules;

  function handleChange(index, text) {
    onChange(rules.map((rule, i) => (i === index ? text : rule)));
  }

  function handleAdd() {
    setAddedIndex(rules.length);
    onChange([...rules, '']);
  }

  return (
    // One flat list of rows, so the Section draws its dividers between them only.
    <Section>
      {[
        ...rules.map((rule, index) => (
          // Keyed by index: a rule's text changes with every keystroke, and two can be the same.
          <View key={index} style={styles.row}>
            <TextInput
              value={rule}
              onChangeText={(text) => handleChange(index, text)}
              placeholder={placeholder}
              maxLength={PERSONA_LIMITS.rule}
              autoFocus={index === addedIndex}
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              style={styles.input}
            />
            <IconButton
              icon="close"
              size={sizes.iconSmall}
              color={colors.text.secondary}
              onPress={() => onChange(rules.filter((_, i) => i !== index))}
              accessibilityLabel="Remove this rule"
            />
          </View>
        )),
        canAdd && (
          <TouchableOpacity
            key="add"
            style={styles.add}
            onPress={handleAdd}
            activeOpacity={0.6}
            accessibilityRole="button"
          >
            <Icon name="add" size={sizes.iconSmall} color={colors.accent.base} />
            <Text style={styles.addLabel}>Add a rule</Text>
          </TouchableOpacity>
        ),
      ]}
    </Section>
  );
}

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
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 14,
  },
  addLabel: {
    fontSize: typography.body,
    color: colors.accent.base,
    fontWeight: '500',
  },
});
