import { StyleSheet, View } from 'react-native';

import PROMPT_BUTTON_ICONS from './promptButtonIcons';

import Card from '@/components/Card';
import IconButton from '@/components/IconButton';
import useHaptics from '@/hooks/useHaptics';
import { colors } from '@/styles/designTokens';

/**
 * The icon a prompt button leads with (`value`, an Icon name or null): None, then the icons it can
 * have, as a wrapped row of round cells, the chosen one on the accent disc. A stored name the list
 * doesn't have is a cell of its own, so a Save keeps it.
 */
export default function IconPicker({ value, onChange }) {
  const haptics = useHaptics();
  const names = value && !PROMPT_BUTTON_ICONS.includes(value) ? [...PROMPT_BUTTON_ICONS, value] : PROMPT_BUTTON_ICONS;

  function handlePick(name) {
    if (name === value) return;
    haptics.selection();
    onChange(name);
  }

  return (
    <Card style={styles.card}>
      <View style={styles.grid} accessibilityRole="radiogroup">
        <IconButton
          icon="circle-off"
          variant={value === null ? 'primary' : 'plain'}
          color={colors.text.secondary}
          accessibilityLabel="No icon"
          onPress={() => handlePick(null)}
        />
        {names.map((name) => (
          <IconButton
            key={name}
            icon={name}
            variant={name === value ? 'primary' : 'plain'}
            color={colors.accent.base}
            accessibilityLabel={name.replace(/-/g, ' ')}
            onPress={() => handlePick(name)}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
});
