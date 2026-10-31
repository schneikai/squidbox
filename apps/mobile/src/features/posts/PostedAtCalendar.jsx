// The Posted sheet's picker on a phone: the native inline calendar with the time under it. Each
// change applies at once. The web version is `PostedAtCalendar.web.jsx`.
import CommunityDateTimePicker from '@react-native-community/datetimepicker';
import { StyleSheet } from 'react-native';

export default function PostedAtCalendar({ timestamp, onChange }) {
  function handleChange(_, date) {
    if (date) onChange(date.getTime());
  }

  return (
    <CommunityDateTimePicker
      mode="datetime"
      display="inline"
      value={new Date(timestamp ?? Date.now())}
      onChange={handleChange}
      style={styles.picker}
    />
  );
}

const styles = StyleSheet.create({
  // The calendar spans the sheet.
  picker: {
    width: '100%',
  },
});
