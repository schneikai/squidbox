import type { ReactNode } from 'react';
import { StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StatusTitle from '@/components/StatusTitle';
import Octopus from '@/components/octopus/Octopus';
import { splashOctopusFrame } from '@/components/octopus/splashOctopusFrame';
import { colors, space } from '@/styles/designTokens';

export type SplashStageProps = {
  label?: string;
  busy?: boolean;
  isLeaving?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
};

// The native splash, carried on: its violet, with the octopus exactly where the splash draws it, and
// light status bar text (given back to the app's once `isLeaving`, as it fades out over the app).
// Under the octopus one white `label` (StatusTitle, a progress bar while `busy`), with what the caller
// adds under it, and a `footer` at the bottom, pushed down by a long label rather than overlapping
// it. The boot screen shows it
// bare, the first-sync screen with its step; their octopuses share one clock, so the boot screen's
// fading out over the first-sync screen's shows one pose.
export default function SplashStage({
  label,
  busy = false,
  isLeaving = false,
  children = null,
  footer = null,
}: SplashStageProps) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const octopus = splashOctopusFrame(window);

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      {!isLeaving && <StatusBar barStyle="light-content" />}
      <View style={{ position: 'absolute', left: octopus.left, top: octopus.top }}>
        <Octopus size={octopus.width} sharedClock />
      </View>
      <View
        style={[
          styles.content,
          { paddingTop: octopus.top + octopus.height + space.xxxl, paddingBottom: insets.bottom + space.xxl },
        ]}
      >
        <View style={styles.column}>
          {label && <StatusTitle title={label} busy={busy} isInverse />}
          {children}
        </View>
        {footer && <View style={styles.footer}>{footer}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background.splash },
  content: { flex: 1 },
  column: { alignItems: 'center', paddingHorizontal: space.xxxl, gap: space.lg },
  footer: { marginTop: 'auto', paddingTop: space.lg, alignItems: 'center' },
});
