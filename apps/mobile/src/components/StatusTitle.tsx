import { ActivityIndicator, StyleSheet, View } from 'react-native';

import Text from '@/components/Text';
import useReduceMotion from '@/hooks/useReduceMotion';
import { colors, space } from '@/styles/designTokens';

export type StatusTitleProps = { title: string; busy?: boolean; isInverse?: boolean };

// A full-screen status's title (StatusScreen on the app background, SplashStage on the splash's
// violet with `isInverse`). While `busy` it reads as a progress bar named by the title, and with
// Reduce Motion, when the octopus stands still, a spinner under it shows that something is going on.
export default function StatusTitle({ title, busy = false, isInverse = false }: StatusTitleProps) {
  const reduceMotion = useReduceMotion();
  const text = (
    <Text variant="heading" tone={isInverse ? 'inverse' : undefined} style={styles.centred}>
      {title}
    </Text>
  );

  if (!busy) return text;

  return (
    <View accessible role="progressbar" aria-busy aria-label={title} style={styles.busy}>
      {text}
      {reduceMotion && <ActivityIndicator color={isInverse ? colors.text.inverse : undefined} />}
    </View>
  );
}

const styles = StyleSheet.create({
  centred: { textAlign: 'center' },
  busy: { alignItems: 'center', gap: space.md },
});
