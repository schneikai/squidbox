import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, space } from '@/styles/designTokens';

/**
 * Returns consistent top/bottom content padding for the three screen types.
 * 'main'   — tab screens: content sits under the floating header and above the floating bars
 * 'detail' — stack screens: content sits under the floating detail header
 */
export default function useScreenPadding(type: 'main' | 'detail' = 'main'): {
  paddingTop: number;
  paddingBottom: number;
} {
  const insets = useSafeAreaInsets();

  if (type === 'detail') {
    return {
      paddingTop: insets.top + layout.contentTop,
      paddingBottom: insets.bottom + space.xxl,
    };
  }

  return {
    paddingTop: insets.top + layout.contentTop,
    paddingBottom: insets.bottom + layout.contentBottom,
  };
}
