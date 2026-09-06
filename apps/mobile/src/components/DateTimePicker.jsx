// Note: the native iOS compact picker has a hardcoded grey background that cannot be
// styled away. We use a pointerEvents="none" overlay to visually replace it.
// opacity: 0.01 keeps the picker interactive (opacity: 0 disables touch on iOS).
import CommunityDateTimePicker from '@react-native-community/datetimepicker';
import { StyleSheet, View, Text } from 'react-native';

import Icon from '@/components/Icon';
import { colors, glass, radii, spacing, typography } from '@/styles/designTokens';

export default function DateTimePicker({ datetime: dt, timestamp, onChange, style = {} }) {
  const dateTime = dt || new Date(timestamp);

  function handleChange(_, date) {
    if (!date) return;
    if (timestamp !== undefined) {
      onChange(date.getTime());
    } else {
      onChange(date);
    }
  }

  const dateLabel = dateTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timeLabel = dateTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.row, style]}>
      <View style={styles.pill}>
        <CommunityDateTimePicker
          mode="date"
          value={dateTime}
          display="compact"
          onChange={handleChange}
          style={styles.nativePicker}
        />
        <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none">
          <Icon name="calendar" size={spacing.iconSizeSmall} color={colors.textSecondary} />
          <Text style={styles.label}>{dateLabel}</Text>
        </View>
      </View>

      <View style={styles.pill}>
        <CommunityDateTimePicker
          mode="time"
          value={dateTime}
          display="compact"
          onChange={handleChange}
          style={styles.nativePicker}
        />
        <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none">
          <Icon name="clock" size={spacing.iconSizeSmall} color={colors.textSecondary} />
          <Text style={styles.label}>{timeLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    ...glass,
    borderRadius: radii.card,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativePicker: {
    opacity: 0.05,
  },
  overlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: typography.input,
    color: colors.text,
    fontWeight: '500',
  },
});
