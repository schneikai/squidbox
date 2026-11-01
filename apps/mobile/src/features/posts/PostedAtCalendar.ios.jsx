// The Posted sheet's picker on iOS: SwiftUI's graphical calendar with the time under it, as wide as
// the sheet. Built from @expo/ui's SwiftUI pieces rather than its DateTimePicker drop-in, to add
// fixedSize: without it the calendar takes the height the host had before it was stretched, and its
// time row is cut off. Each change applies at once. Android: `PostedAtCalendar.jsx`; web:
// `PostedAtCalendar.web.jsx`.
// Source paths: Metro here resolves without package exports (metro.config.js).
import { DatePicker, Host } from '@expo/ui/src/swift-ui';
import { datePickerStyle, fixedSize, tint } from '@expo/ui/src/swift-ui/modifiers';
import { StyleSheet } from 'react-native';

import { colors } from '@/styles/designTokens';

const MODIFIERS = [
  datePickerStyle('graphical'),
  tint(colors.accent.base),
  fixedSize({ horizontal: false, vertical: true }),
];

export default function PostedAtCalendar({ timestamp, onChange }) {
  function handleChange(date) {
    onChange(date.getTime());
  }

  return (
    <Host matchContents={{ vertical: true }} style={styles.picker}>
      <DatePicker
        selection={new Date(timestamp ?? Date.now())}
        displayedComponents={['date', 'hourAndMinute']}
        onDateChange={handleChange}
        modifiers={MODIFIERS}
      />
    </Host>
  );
}

const styles = StyleSheet.create({
  picker: {
    width: '100%',
  },
});
