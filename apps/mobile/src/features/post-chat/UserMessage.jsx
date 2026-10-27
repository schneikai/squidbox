import { PERSONA_LIMITS } from '@squidbox/shared';
import { Alert, StyleSheet, Text, View } from 'react-native';

import GradientFill from '@/components/GradientFill';
import IconMenuButton from '@/components/IconMenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useHaptics from '@/hooks/useHaptics';
import useLibrary from '@/library/useLibrary';
import { colors, lineHeights, sizes, typography } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { readPersona, savePersona } from '@/sync/personaRepository';
import { requestSync } from '@/sync/worker';

/**
 * One of the user's turns in the chat: a violet bubble with the prompt button's name (`label`) over
 * what was sent (`content`), and a ⋯ under it to add the text to the rules of Writing as you.
 */
export default function UserMessage({ label, content }) {
  const haptics = useHaptics();
  const { library } = useLibrary();
  const userId = library.owner.userId;

  async function handleAddToRules() {
    const rule = content.trim();
    if (rule.length > PERSONA_LIMITS.rule) {
      Alert.alert('Too long for a rule', `A rule can have up to ${PERSONA_LIMITS.rule} characters.`);
      return;
    }
    try {
      const db = getDb();
      const rules = (await readPersona(db, userId))?.rules ?? [];
      if (!rules.includes(rule)) {
        if (rules.length >= PERSONA_LIMITS.rules) {
          Alert.alert('No room for another rule', `Writing as you has up to ${PERSONA_LIMITS.rules} rules.`);
          return;
        }
        await savePersona(db, userId, { rules: [...rules, rule] });
        requestSync();
      }
      haptics.success();
    } catch (error) {
      console.error('Adding the rule failed', error);
      haptics.error();
      Alert.alert("Couldn't add the rule", error.message);
    }
  }

  return (
    <View style={styles.message}>
      <GradientFill style={styles.bubble}>
        {!!label && <Text style={styles.label}>{label}</Text>}
        <Text style={styles.content} selectable>
          {content}
        </Text>
      </GradientFill>
      <IconMenuButton
        size={sizes.iconSmall}
        color={colors.text.secondary}
        accessibilityLabel="More for this message"
        style={styles.menu}
      >
        <MenuOption label="Add to rules" icon="list-checks" onPress={handleAddToRules} />
      </IconMenuButton>
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    alignItems: 'flex-end',
    paddingLeft: 48,
  },
  bubble: {
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
    gap: 4,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text.inverse,
    opacity: 0.8,
  },
  content: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.text.inverse,
  },
  // Close under the bubble: the button's tap target overlaps the gap above it.
  menu: {
    marginTop: -6,
    marginBottom: -10,
  },
});
