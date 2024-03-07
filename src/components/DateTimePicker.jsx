// https://github.com/react-native-datetimepicker/datetimepicker
import CommunityDateTimePicker from '@react-native-community/datetimepicker';
import { StyleSheet, View, Text } from 'react-native';

export default function DateTimePicker({ datetime: dt, timestamp, onChange, style = {} }) {
  const dateTime = dt || new Date(timestamp);

  return (
    <View style={[styles.container, style]}>
      <Text>Posted At</Text>
      <View style={styles.pickerContainer}>
        <CommunityDateTimePicker
          mode="datetime"
          value={dateTime}
          display="compact"
          onChange={(event, date) => {
            if (timestamp) {
              // if a timestamp was given we return a timestamp
              onChange(date.getTime());
              return;
            }

            onChange(date);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerContainer: {
    flexGrow: 1,
  },
});
