import { Text } from 'react-native';

import ScreenHeaderContainer from '@/components/screen-header/ScreenHeaderContainer';
import screenHeaderStyles from '@/styles/screenHeaderStyles';

export default function ScreenHeader({ label, children, insets = { top: 0 } }) {
  return (
    <ScreenHeaderContainer insets={insets}>
      <Text style={screenHeaderStyles.title}>{label}</Text>
      {children}
    </ScreenHeaderContainer>
  );
}
