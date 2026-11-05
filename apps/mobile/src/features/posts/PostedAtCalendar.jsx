// The Posted sheet's picker: the system's inline calendar with the time under it (SwiftUI on iOS,
// Jetpack Compose on Android, through @expo/ui's DateTimePicker), as wide as the sheet. Each change
// applies at once. Web: `PostedAtCalendar.web.jsx`.
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { Platform, StyleSheet } from 'react-native';

import { colors, scale } from '@/styles/designTokens';

// What SwiftUI's graphical calendar leaves between its edges and its month and weekdays.
// eslint-disable-next-line no-restricted-syntax -- SwiftUI's own inset, matched, not ours
const IOS_CALENDAR_INSET = scale(16);

export default function PostedAtCalendar({ timestamp, onChange }) {
  function handleChange(_, date) {
    if (date) onChange(date.getTime());
  }

  return (
    <DateTimePicker
      mode="datetime"
      display="inline"
      value={new Date(timestamp ?? Date.now())}
      onValueChange={handleChange}
      accentColor={colors.accent.base}
      style={styles.picker}
    />
  );
}

const styles = StyleSheet.create({
  // On iOS, reaching past the sheet's padding by the calendar's own inset lines its month and
  // weekdays up with the sheet's title and its ×.
  picker: {
    alignSelf: 'stretch',
    marginHorizontal: Platform.OS === 'ios' ? -IOS_CALENDAR_INSET : 0,
  },
});
