import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import libraryLabel from './libraryLabel';

import { colors } from '@/styles/designTokens';

// Shown while one library closes and another opens (LibraryGate in App.js): nothing of the app is
// mounted meanwhile, so no screen reads across the switch.
export default function SwitchingScreen({ library }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.title}>Opening {libraryLabel(library)}…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 8, textAlign: 'center' },
});
