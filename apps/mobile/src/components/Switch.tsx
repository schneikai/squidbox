import { Switch as NativeSwitch, type SwitchProps } from 'react-native';

import { colors } from '@/styles/designTokens';

// react-native-web colors a switched-on thumb with this one instead (teal by default). React Native's
// types don't know it, so it's spread in.
const WEB_PROPS = { activeThumbColor: colors.background.surface };

// The platform switch in the app's colors. Takes React Native's Switch props.
export default function Switch(props: SwitchProps) {
  return (
    <NativeSwitch
      trackColor={{ false: colors.border.glass, true: colors.accent.base }}
      thumbColor={colors.background.surface}
      {...WEB_PROPS}
      {...props}
    />
  );
}
