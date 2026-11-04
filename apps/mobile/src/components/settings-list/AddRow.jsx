import { StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import { SCREEN_PADDING } from '@/constants';

/**
 * The last row of a Section that adds to its list ("Add a rule", "Add a model"): the add of a list
 * of rows always sits at its end, like a list of chips ends with an Add chip.
 */
export default function AddRow({ label, onPress }) {
  return (
    <View style={styles.add}>
      <Button icon="add" label={label} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The button's own inset is wider than the rows', so its icon lines up with their text.
  add: {
    alignItems: 'flex-start',
    marginLeft: SCREEN_PADDING - 24,
  },
});
