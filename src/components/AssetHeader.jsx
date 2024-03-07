import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View, StyleSheet, Pressable } from 'react-native';

import dateToSimpleFormat from '@/utils/date-time/dateToSimpleFormat';

export default function AssetHeader({ asset, onPressBack, children }) {
  return (
    <View style={styles.container}>
      <Pressable onPress={onPressBack} style={styles.leftContainer}>
        <View style={styles.backButton}>
          <Ionicons name="arrow-back" />
          <Text>Back</Text>
        </View>
        {asset && <Text style={styles.title}>{dateToSimpleFormat(asset.createdAt)}</Text>}
      </Pressable>
      <View style={styles.actionsContainer}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    paddingHorizontal: 10,
  },
  leftContainer: {
    height: 40,
    alignContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
  },
  actionsContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
});
