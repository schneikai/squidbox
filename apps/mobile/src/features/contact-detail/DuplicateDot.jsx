import { StyleSheet, View } from 'react-native';

import { colors, scale } from '@/styles/designTokens';

const DOT = scale(8);

/** The amber dot of a possible duplicate: on a field another contact has too, and on the card that lists them. */
export default function DuplicateDot({ accessibilityLabel }) {
  return <View style={styles.dot} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} />;
}

const styles = StyleSheet.create({
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.status.warning,
  },
});
