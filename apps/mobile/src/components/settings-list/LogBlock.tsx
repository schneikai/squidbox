import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Section } from './SettingsList';

import { SCREEN_PADDING } from '@/constants';
import { colors, typography } from '@/styles/designTokens';

export type LogBlockProps = { children?: ReactNode; maxHeight?: number };

// A Section holding a fixed-height, internally-scrolling log (sync runs, backup runs).
export function LogBlock({ children, maxHeight = 200 }: LogBlockProps) {
  return (
    <Section>
      <ScrollView style={{ maxHeight }} nestedScrollEnabled contentContainerStyle={styles.inner}>
        {children}
      </ScrollView>
    </Section>
  );
}

export type LogLineProps = { primary: string; secondary?: string | null; error?: string | null };

export function LogLine({ primary, secondary, error }: LogLineProps) {
  return (
    <View style={styles.entry}>
      <Text style={styles.primary}>{primary}</Text>
      {secondary ? <Text style={styles.secondary}>{secondary}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export type LogEmptyProps = { text: string };

export function LogEmpty({ text }: LogEmptyProps) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  inner: { gap: 8, paddingHorizontal: SCREEN_PADDING, paddingVertical: 12 },
  entry: { gap: 1 },
  primary: { fontSize: typography.footnote, color: colors.text.primary, fontVariant: ['tabular-nums'] },
  secondary: { fontSize: typography.caption2, color: colors.text.secondary },
  error: { fontSize: typography.caption2, color: colors.status.danger },
  empty: { fontSize: typography.footnote, color: colors.text.secondary },
});
