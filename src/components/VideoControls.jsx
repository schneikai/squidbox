import { View, StyleSheet, Text } from 'react-native';

import formatVideoDuration from '@/utils/formatVideoDuration';

export default function VideoControls({ asset }) {
  return (
    <View style={styles.container}>
      <View style={styles.toolBar}>
        <Text>{formatVideoDuration(asset.duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    padding: 20,
    alignItems: 'center',
  },
  toolBar: {
    backgroundColor: 'lightgrey',
    borderRadius: 30,
    padding: 10,
    alignItems: 'center',
  },
});
