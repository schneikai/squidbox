import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import Page from '@/components/Page';

// A full-screen status while the app can't show its content: a title, centred on the app
// background, a spinner above it while `busy`, and whatever details the caller adds below it.
export default function StatusScreen({ busy = false, title, children }) {
  return (
    <Page>
      <View style={styles.center}>
        {busy && <ActivityIndicator size="large" />}
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 8, textAlign: 'center' },
});
