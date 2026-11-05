import { type ColorValue, Switch as NativeSwitch, type SwitchProps } from 'react-native';

import { colors } from '@/styles/designTokens';

// react-native-web colors a switched-on thumb with `activeThumbColor` (teal by default); React
// Native's types leave it out.
declare module 'react-native' {
  interface SwitchProps {
    activeThumbColor?: ColorValue;
  }
}

// The platform switch in the app's colors. Takes React Native's Switch props.
export default function Switch(props: SwitchProps) {
  return (
    <NativeSwitch
      trackColor={{ false: colors.border.glass, true: colors.accent.base }}
      thumbColor={colors.background.surface}
      activeThumbColor={colors.background.surface}
      {...props}
    />
  );
}
