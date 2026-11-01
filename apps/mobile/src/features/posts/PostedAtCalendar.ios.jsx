// The Posted sheet's picker on iOS: SwiftUI's graphical calendar with the time under it, as wide as
// the sheet. Built from @expo/ui's SwiftUI pieces rather than its DateTimePicker drop-in, to add
// fixedSize, and to size the host from onLayoutContent: the host's own matchContents resizes it only
// on the next layout pass (leaving and reopening the app), so on first open the time row was cut off. Each change applies at once. Android: `PostedAtCalendar.jsx`; web:
// `PostedAtCalendar.web.jsx`.
// Source paths: Metro here resolves without package exports (metro.config.js).
import { DatePicker, Host } from '@expo/ui/src/swift-ui';
import { datePickerStyle, fixedSize, tint } from '@expo/ui/src/swift-ui/modifiers';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { colors, scale } from '@/styles/designTokens';

// What SwiftUI's graphical calendar leaves between its edges and its month and weekdays.
const CALENDAR_INSET = scale(16);
const MODIFIERS = [
  datePickerStyle('graphical'),
  tint(colors.accent.base),
  fixedSize({ horizontal: false, vertical: true }),
];

export default function PostedAtCalendar({ timestamp, onChange }) {
  const [height, setHeight] = useState(null);

  function handleChange(date) {
    onChange(date.getTime());
  }

  function handleLayoutContent(event) {
    setHeight(event.nativeEvent.height);
  }

  return (
    <Host onLayoutContent={handleLayoutContent} style={[styles.picker, height != null && { height }]}>
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
  // SwiftUI's graphical calendar pads its month and weekdays in from its edges; reaching past the
  // sheet's padding by as much lines them up with the sheet's title and its ×.
  picker: {
    alignSelf: 'stretch',
    marginHorizontal: -CALENDAR_INSET,
  },
});
