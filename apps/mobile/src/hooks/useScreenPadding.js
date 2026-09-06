import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/styles/designTokens';

/**
 * Returns consistent top/bottom content padding for the three screen types.
 * 'main'   — tab screens: content sits under the floating header and above the floating bars
 * 'detail' — stack screens: content sits under the floating detail header
 */
export default function useScreenPadding(type = 'main') {
  const insets = useSafeAreaInsets();

  if (type === 'detail') {
    return {
      paddingTop: insets.top + spacing.contentPaddingTop,
      paddingBottom: insets.bottom + 24,
    };
  }

  return {
    paddingTop: insets.top + spacing.contentPaddingTop,
    paddingBottom: insets.bottom + spacing.contentPaddingBottom,
  };
}
