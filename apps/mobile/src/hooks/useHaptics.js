import { requireOptionalNativeModule } from 'expo';
import {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
} from 'expo-haptics';

import useAppSettings from '@/features/app-settings/useAppSettings';

// Builds from before expo-haptics was added lack its native module, and web has none: both stay silent.
const canPlayHaptics = requireOptionalNativeModule('ExpoHaptics') !== null;

// The app's haptic moments (Apple's HIG: a tap marks something the user did or that happened, never
// every touch). A peek is firmer than the lift before it, so holding on reads as a second step.
const HAPTICS = {
  lift: () => impactAsync(ImpactFeedbackStyle.Light),
  drop: () => impactAsync(ImpactFeedbackStyle.Soft),
  peek: () => impactAsync(ImpactFeedbackStyle.Medium),
  selection: () => selectionAsync(),
  success: () => notificationAsync(NotificationFeedbackType.Success),
  error: () => notificationAsync(NotificationFeedbackType.Error),
};
const SILENT = Object.fromEntries(Object.keys(HAPTICS).map((name) => [name, () => {}]));

/**
 * Haptic feedback that follows the Haptics setting: `lift`/`drop` (a drag), `peek` (the quick view),
 * `selection` (a selection change), `success`/`error` (an outcome). Each is stable while the setting
 * holds, so gestures can keep them in their deps.
 */
export default function useHaptics() {
  const { isHapticsOn } = useAppSettings();
  return isHapticsOn && canPlayHaptics ? HAPTICS : SILENT;
}
