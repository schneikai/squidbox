import { StyleSheet, View } from 'react-native';

import voiceFields from './voiceFields';

import BottomSheet from '@/components/BottomSheet';
import Text from '@/components/Text';
import { colors, layout, radii, space } from '@/styles/designTokens';

// What goes in a field of Writing as you (`field`, a key of voiceFields): its description and three
// examples. `field` stays set while the sheet slides away after `isVisible` turned false.
export default function FieldInfoSheet({ field, isVisible, onClose }) {
  const { label, description, examples } = voiceFields[field];

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} title={label}>
      <Text tone="secondary">{description}</Text>
      <Text variant="label" style={styles.heading}>
        For example
      </Text>
      <View style={styles.examples}>
        {examples.map((example) => (
          <View key={example} style={styles.example}>
            <Text>{example}</Text>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  examples: {
    gap: space.sm,
  },
  example: {
    backgroundColor: colors.background.tint,
    borderRadius: radii.card,
    paddingHorizontal: layout.cardInset,
    paddingVertical: space.md,
  },
});
