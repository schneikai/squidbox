import { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { formatDateTime } from "services/TimeService";

export default function PostedAtControl({ postedAt, setPostedAt }) {
  const [inputVisible, setInputVisible] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(false);
  const [postedAtInitialValue, setPostedAtInitialValue] = useState(postedAt);

  function getPostedAtLabel(postedAt) {
    if (postedAt) {
      return formatDateTime(postedAt);
    } else {
      return "Now";
    }
  }

  function toggleInput() {
    setInputVisible((visible) => {
      visible = !visible;
      if (visible) {
        setDatePickerValue(new Date());
      } else {
        setPostedAt(postedAtInitialValue);
      }

      return visible;
    });
  }

  function onPick(event, date) {
    setDatePickerValue(date);
    setPostedAt(date);
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={toggleInput}>
        <Text style={styles.label}>Posted at: {!inputVisible && <Text>{getPostedAtLabel(postedAt)}</Text>}</Text>
      </Pressable>
      {inputVisible && (
        <DateTimePicker
          mode="datetime"
          value={datePickerValue}
          onChange={onPick}
          locale="en-UK"
          style={styles.datePicker}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    height: 50,
  },
  label: {
    color: "grey",
    fontWeight: "500",
    fontSize: 14,
  },
  datePicker: {
    flex: 1,
  },
});
