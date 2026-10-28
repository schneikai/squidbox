import { StyleSheet, View } from 'react-native';

import TextButton from '@/components/TextButton';
import { sizes } from '@/styles/designTokens';

/**
 * Cancel on the leading side of a draft sheet's header (EditSheet): a TextButton, one button tall
 * like the header's other pills. ModalHeader wraps it in FloatingPill automatically.
 */
export default function ModalCancelButton({ onPress }) {
  return (
    <View style={styles.slot}>
      <TextButton label="Cancel" onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: sizes.iconButton,
    justifyContent: 'center',
  },
});
