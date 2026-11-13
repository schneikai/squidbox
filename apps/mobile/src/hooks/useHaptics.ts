import { requireOptionalNativeModule } from 'expo';
import {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
} from 'expo-haptics';

import useAppSettings from '@/providers/app-settings/useAppSettings';

// The web, and a build without expo-haptics' native module, stay silent.
const canPlayHaptics = requireOptionalNativeModule('ExpoHaptics') !== null;

// The app's haptic moments (Apple's HIG: a tap marks something the user did or that happened, never
// every touch). A peek is firmer than the lift before it, so holding on reads as a second step.
// Every moment, whether it plays or stays silent.
type Haptics = Record<'lift' | 'drop' | 'peek' | 'selection' | 'success' | 'error', () => unknown>;

const HAPTICS: Haptics = {
  lift: () => impactAsync(ImpactFeedbackStyle.Light),
  drop: () => impactAsync(ImpactFeedbackStyle.Soft),
  peek: () => impactAsync(ImpactFeedbackStyle.Medium),
  selection: selectionAsync,
  success: () => notificationAsync(NotificationFeedbackType.Success),
  error: () => notificationAsync(NotificationFeedbackType.Error),
};
const SILENT = Object.fromEntries(Object.keys(HAPTICS).map((name) => [name, () => {}])) as Haptics;

/**
 * Haptic feedback that follows the Haptics setting: `lift`/`drop` (a drag), `peek` (the quick view),
 * `selection` (a selection change), `success`/`error` (an outcome). Each is stable while the setting
 * holds, so gestures can keep them in their deps.
 */
export default function useHaptics(): Haptics {
  const { isHapticsOn } = useAppSettings();
  return isHapticsOn && canPlayHaptics ? HAPTICS : SILENT;
}
