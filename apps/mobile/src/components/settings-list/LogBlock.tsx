import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Section } from './SettingsList';

import { colors, layout, space, textStyles } from '@/styles/designTokens';

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
  inner: { gap: space.sm, paddingHorizontal: layout.rowInset, paddingVertical: layout.rowPaddingYCompact },
  entry: { gap: space.hair },
  primary: { ...textStyles.footnote, color: colors.text.primary, fontVariant: ['tabular-nums'] },
  secondary: { ...textStyles.caption2, color: colors.text.secondary },
  error: { ...textStyles.caption2, color: colors.status.danger },
  empty: { ...textStyles.footnote, color: colors.text.secondary },
});
