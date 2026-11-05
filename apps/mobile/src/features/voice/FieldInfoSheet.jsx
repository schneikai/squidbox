import { StyleSheet, Text, View } from 'react-native';

import voiceFields from './voiceFields';

import BottomSheet from '@/components/BottomSheet';
import { colors, layout, radii, space, textStyles } from '@/styles/designTokens';

// What goes in a field of Writing as you (`field`, a key of voiceFields): its description and three
// examples. `field` stays set while the sheet slides away after `isVisible` turned false.
export default function FieldInfoSheet({ field, isVisible, onClose }) {
  const { label, description, examples } = voiceFields[field];

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} title={label}>
      <Text style={[textStyles.reading, styles.description]}>{description}</Text>
      <Text style={[textStyles.footnoteBold, styles.heading]}>For example</Text>
      <View style={styles.examples}>
        {examples.map((example) => (
          <View key={example} style={styles.example}>
            <Text style={[textStyles.reading, styles.exampleText]}>{example}</Text>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  description: {
    color: colors.text.secondary,
  },
  heading: {
    color: colors.text.secondary,
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
  exampleText: {
    color: colors.text.primary,
  },
});
