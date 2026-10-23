import { Switch as NativeSwitch } from 'react-native';

import { colors } from '@/styles/designTokens';

// The platform switch in the app's colors. Takes React Native's Switch props.
export default function Switch(props) {
  return (
    <NativeSwitch
      trackColor={{ false: colors.border.glass, true: colors.accent.base }}
      thumbColor={colors.background.surface}
      // react-native-web colors a switched-on thumb with this one instead (teal by default).
      activeThumbColor={colors.background.surface}
      {...props}
    />
  );
}
