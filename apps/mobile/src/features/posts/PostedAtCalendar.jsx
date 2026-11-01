// The Posted sheet's picker on Android: the system's inline calendar with the time under it (Jetpack
// Compose, through @expo/ui's DateTimePicker), as wide as the sheet. Each change applies at once.
// iOS: `PostedAtCalendar.ios.jsx`; web: `PostedAtCalendar.web.jsx`.
// The source path: Metro here resolves without package exports (metro.config.js), so the
// '@expo/ui/community/datetime-picker' subpath isn't found.
import DateTimePicker from '@expo/ui/src/community/datetime-picker';
import { StyleSheet } from 'react-native';

import { colors } from '@/styles/designTokens';

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
  picker: {
    width: '100%',
  },
});
