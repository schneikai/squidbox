// The Posted sheet's picker on a phone: the system's inline calendar with the time under it (SwiftUI
// on iOS, Jetpack Compose on Android, through @expo/ui), as wide as the sheet. Each change applies at
// once. The web version is `PostedAtCalendar.web.jsx`.
import DateTimePicker from '@expo/ui/datetimepicker';
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
