import { View } from 'react-native';

import screenHeaderStyles from '@/styles/screenHeaderStyles';

export default function ScreenHeaderContainer({ insets = { top: 0 }, children }) {
  return <View style={[screenHeaderStyles.container, { marginTop: insets.top }]}>{children}</View>;
}
