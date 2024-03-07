import { View } from 'react-native';

import globalStyles from '@/styles';

export default function HeaderActions({ children }) {
  return <View style={globalStyles.screenHeaderNavigation}>{children}</View>;
}
