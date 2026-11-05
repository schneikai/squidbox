import { CONTACT_LIMITS, formatPlace, placeParts } from '@squidbox/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import Divider from '@/components/Divider';
import Icon from '@/components/Icon';
import AddRow from '@/components/settings-list/AddRow';
import { colors, layout, press, scale, sizes, typography } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

const ICON_GAP = 12;

/**
 * A contact's places as a card: each place one row, its city over "State, Country" (what it has
 * when it has no city), opening it with `onEdit(index)`; "Add place" at the card's end calls
 * `onAdd()` until it holds CONTACT_LIMITS.places. The places are edited in a sheet (PlaceEditor).
 */
export default function PlacesField({ places, onEdit, onAdd }) {
  return (
    <Card>
      {places.map((stored, index) => {
        const place = placeParts(stored);
        const title = place.city || formatPlace(place);
        const detail = place.city ? [place.state, place.country].filter(Boolean).join(', ') : '';
        return (
          // The index is the place: a place has no id.
          // eslint-disable-next-line react/no-array-index-key
          <View key={index}>
            <Pressable
              onPress={() => onEdit(index)}
              accessibilityRole="button"
              accessibilityLabel={formatPlace(place)}
              accessibilityHint="Edits the place"
              style={({ pressed }) => [styles.row, pressed && press.flat]}
            >
              <Icon name="map-pin" size={sizes.icon} color={colors.text.secondary} />
              <View style={styles.labels}>
                <Text style={styles.title}>{title}</Text>
                {!!detail && <Text style={listTextStyles.detail}>{detail}</Text>}
              </View>
              <Icon name="chevron-right" size={sizes.iconSmall} color={colors.text.tertiary} />
            </Pressable>
            <Divider style={index === places.length - 1 ? undefined : styles.divider} />
          </View>
        );
      })}
      {places.length < CONTACT_LIMITS.places && <AddRow label="Add place" onPress={onAdd} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ICON_GAP,
    minHeight: scale(60),
    paddingVertical: 8,
    paddingHorizontal: layout.sideGutter,
  },
  labels: {
    flex: 1,
  },
  title: {
    fontSize: typography.body,
    color: colors.text.primary,
  },
  // Between places, the line starts at the text.
  divider: {
    marginLeft: layout.sideGutter + sizes.icon + ICON_GAP,
  },
});
