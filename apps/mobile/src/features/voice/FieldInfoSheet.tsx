import { StyleSheet, View } from 'react-native';

import voiceFields from './voiceFields';

import BottomSheet from '@/components/BottomSheet';
import Note from '@/components/Note';
import Text from '@/components/Text';
import { space } from '@/styles/designTokens';

export type FieldInfoSheetProps = {
  // A field with an ⓘ sheet: Rules have screens of their own.
  field: Exclude<keyof typeof voiceFields, 'rules'>;
  isVisible: boolean;
  onClose: () => void;
};

// What goes in a field of Writing as you (`field`, a key of voiceFields): its description and three
// examples. `field` stays set while the sheet slides away after `isVisible` turned false.
export default function FieldInfoSheet({ field, isVisible, onClose }: FieldInfoSheetProps) {
  const { label, description, examples } = voiceFields[field];

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} title={label}>
      <Text tone="secondary">{description}</Text>
      <Text variant="label" style={styles.heading}>
        For example
      </Text>
      <View style={styles.examples}>
        {examples.map((example) => (
          <Note key={example} tone="tint">
            <Text>{example}</Text>
          </Note>
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
});
