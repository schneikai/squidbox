// The post editor's quiet Posted time: a clock and the time as grey text ("Today, 12:39", or "Not posted"
// without one), over the native compact picker. That picker has a hardcoded grey background that
// cannot be styled away, so it stays interactive but nearly invisible (opacity 0 disables touch on
// iOS) under the label, which lets touches through (pointerEvents="none") and gives the control its
// size.
// `mode="datetime"` is iOS-only in the library; on web the library renders nothing, so the label shows
// and the time can't be changed there.
import CommunityDateTimePicker from '@react-native-community/datetimepicker';
import { StyleSheet, View, Text } from 'react-native';

import Icon from '@/components/Icon';
import { colors, scale, sizes, typography } from '@/styles/designTokens';
import formatDetailHeaderDate from '@/utils/date-time/formatDetailHeaderDate';

export default function PostedAtPicker({ timestamp, onChange, style }) {
  const label = timestamp == null ? 'Not posted' : formatLabel(timestamp);

  function handleChange(_, date) {
    if (date) onChange(date.getTime());
  }

  return (
    <View style={[styles.container, style]}>
      <CommunityDateTimePicker
        accessibilityLabel={timestamp == null ? label : `Posted at ${label}`}
        mode="datetime"
        display="compact"
        value={new Date(timestamp ?? Date.now())}
        onChange={handleChange}
        style={styles.nativePicker}
      />
      <View style={styles.label} pointerEvents="none">
        <Icon name="clock" size={sizes.iconSmall} color={colors.text.secondary} />
        <Text style={styles.labelText}>{label}</Text>
      </View>
    </View>
  );
}

function formatLabel(timestamp) {
  const { title, subtitle } = formatDetailHeaderDate(timestamp);
  return `${title}, ${subtitle}`;
}

const styles = StyleSheet.create({
  container: {
    minHeight: sizes.iconButton,
    justifyContent: 'center',
  },
  nativePicker: {
    position: 'absolute',
    left: 0,
    opacity: 0.05,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(8),
  },
  labelText: {
    fontSize: typography.subheadline,
    color: colors.text.secondary,
  },
});
