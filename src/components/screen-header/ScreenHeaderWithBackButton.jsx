import Ionicons from '@expo/vector-icons/Ionicons';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import ScreenHeaderContainer from '@/components/screen-header/ScreenHeaderContainer';
import screenHeaderStyles from '@/styles/screenHeaderStyles';

export default function ScreenHeaderWithBackButton({
  label,
  SubLabelComponent,
  onPressBack,
  children,
  insets = { top: 0 },
}) {
  return (
    <ScreenHeaderContainer insets={insets}>
      <TouchableOpacity onPress={onPressBack} style={styles.backButtonWithLabel}>
        <View style={styles.backButton}>
          <Ionicons name="arrow-back" />
          <Text>Back</Text>
        </View>
        <Text style={screenHeaderStyles.title}>{label}</Text>
        {SubLabelComponent}
      </TouchableOpacity>
      {children}
    </ScreenHeaderContainer>
  );
}

const styles = StyleSheet.create({
  backButtonWithLabel: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
