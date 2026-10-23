import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import Page from '@/components/Page';
import Octopus from '@/components/octopus/Octopus';
import useReduceMotion from '@/hooks/useReduceMotion';
import { scale, typography } from '@/styles/designTokens';

const OCTOPUS_SIZE = scale(150);

// A full-screen status while the app can't show its content: a title, centred on the app
// background, the octopus above it while `busy`, and whatever details the caller adds below it.
// With Reduce Motion the octopus stands still, so a spinner shows that something is going on.
export default function StatusScreen({ busy = false, title, children }) {
  const reduceMotion = useReduceMotion();

  return (
    <Page>
      <View style={styles.center}>
        {busy && (
          <View accessible role="progressbar" aria-label="Loading" aria-busy style={styles.busy}>
            <Octopus size={OCTOPUS_SIZE} />
            {reduceMotion && <ActivityIndicator />}
          </View>
        )}
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  busy: { alignItems: 'center', gap: 12 },
  title: { fontSize: typography.title2, fontWeight: '700', marginTop: 16, textAlign: 'center' },
});
