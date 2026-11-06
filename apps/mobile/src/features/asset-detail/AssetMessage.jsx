import { StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import Text from '@/components/Text';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import { colors, layout, sizes } from '@/styles/designTokens';

// Why the current page shows no photo or video: `message` is { icon, text }.
export default function AssetMessage({ message }) {
  if (!message) return null;

  return (
    <FloatingPill style={styles.message}>
      <Icon name={message.icon} color={colors.text.secondary} style={styles.messageIcon} />
      <Text variant="hint" tone="primary" style={styles.messageText}>
        {message.text}
      </Text>
    </FloatingPill>
  );
}

const styles = StyleSheet.create({
  message: {
    marginHorizontal: layout.sideGutter,
  },
  // Sits where a button would: a toolbar is one button tall.
  messageIcon: {
    marginLeft: layout.barPaddingX,
    marginVertical: (sizes.iconButton - sizes.icon) / 2,
  },
  messageText: {
    flexShrink: 1,
    paddingHorizontal: layout.barPaddingX,
  },
});
