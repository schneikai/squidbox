import { Switch as NativeSwitch } from 'react-native';

import { colors } from '@/styles/designTokens';

// The platform switch in the app's colors. Takes React Native's Switch props.
export default function Switch(props) {
  return (
    <NativeSwitch
      trackColor={{ false: colors.glassBorder, true: colors.accent }}
      thumbColor={colors.textInverse}
      {...props}
    />
  );
}
