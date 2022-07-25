import { Alert } from "react-native";

export function handleError(alertMessage, err) {
  console.log(err);
  Alert.alert(alertMessage, err.message);
}
