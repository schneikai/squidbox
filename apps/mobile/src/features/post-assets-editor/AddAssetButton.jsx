import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function AddAssetButton({ onAdd, itemDimension }) {
  return (
    <TouchableOpacity onPress={onAdd} style={[styles.rowItem, itemDimension]}>
      <View style={styles.addItem}>
        <Text style={styles.addItemText}>+</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  rowItem: {
    padding: 5,
  },
  addItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'gray',
  },
  addItemText: {
    fontSize: 50,
    color: 'black',
  },
});
