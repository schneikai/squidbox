import type { ReactNode } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Octopus from '@/components/octopus/Octopus';
import { splashOctopusFrame } from '@/components/octopus/splashOctopusFrame';
import useReduceMotion from '@/hooks/useReduceMotion';
import { colors, space, textStyles } from '@/styles/designTokens';

export type SplashStageProps = { label?: string; busy?: boolean; children?: ReactNode; footer?: ReactNode };

// The native splash, carried on: its violet, with the octopus exactly where the splash draws it, and
// light status bar text. Under the octopus one white `label` (with what the caller adds under it),
// and a `footer` at the bottom. While `busy` the label reads as a progress bar, and with Reduce Motion
// (the octopus stands still) a spinner shows under it. The boot screen shows it bare, the first-sync
// screen with its step. StatusScreen is its sibling on the app background (same title, progress bar
// and spinner): a change to one belongs in both.
export default function SplashStage({ label, busy = false, children = null, footer = null }: SplashStageProps) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const octopus = splashOctopusFrame(window);
  const labelText = label ? <Text style={styles.label}>{label}</Text> : null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <StatusBar barStyle="light-content" />
      <View style={{ position: 'absolute', left: octopus.left, top: octopus.top }}>
        <Octopus size={octopus.width} />
      </View>
      <View style={[styles.column, { top: octopus.top + octopus.height + space.xxxl }]}>
        {busy && label ? (
          <View accessible role="progressbar" aria-busy aria-label={label} style={styles.busy}>
            {labelText}
            {reduceMotion && <ActivityIndicator color={colors.text.inverse} />}
          </View>
        ) : (
          labelText
        )}
        {children}
      </View>
      {footer && <View style={[styles.footer, { bottom: insets.bottom + space.xxl }]}>{footer}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background.splash },
  column: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: space.xxxl,
    gap: space.lg,
  },
  busy: { alignItems: 'center', gap: space.lg },
  label: { ...textStyles.title2, color: colors.text.inverse, textAlign: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
