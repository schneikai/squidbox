import { CONTACT_LIMITS } from '@squidbox/shared';
import { StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import Card from '@/components/Card';
import Divider from '@/components/Divider';
import TextInput from '@/components/TextInput';
import AddRow from '@/components/settings-list/AddRow';
import { layout, scale } from '@/styles/designTokens';

/**
 * A contact's places as a card: one row per place, each with × to take it out, and "Add place" at
 * its end, until it holds CONTACT_LIMITS.places. `places` is the list as typed (an empty row is a place being added); every edit hands
 * the whole list to `onChange`.
 */
export default function PlacesField({ places, onChange, onBlur }) {
  function setPlace(index, text) {
    onChange(places.map((place, i) => (i === index ? text : place)));
  }

  return (
    <Card>
      {places.map((place, index) => (
        // The index is the row: a place has no id, and rows only change at the end or by ×.
        // eslint-disable-next-line react/no-array-index-key
        <View key={index}>
          <View style={styles.row}>
            <TextInput
              value={place}
              onChangeText={(text) => setPlace(index, text)}
              onBlur={onBlur}
              placeholder="City, Country"
              maxLength={CONTACT_LIMITS.place}
              style={styles.input}
              accessibilityLabel={`Place ${index + 1}`}
              autoFocus={!place && index === places.length - 1}
            />
            <Button
              icon="close"
              onPress={() => onChange(places.filter((_, i) => i !== index))}
              accessibilityLabel="Remove place"
            />
          </View>
          <Divider />
        </View>
      ))}
      {places.length < CONTACT_LIMITS.places && <AddRow label="Add place" onPress={() => onChange([...places, ''])} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: scale(52),
    paddingLeft: layout.sideGutter,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
  },
});
