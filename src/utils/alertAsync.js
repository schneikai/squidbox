import { Alert } from 'react-native';

// Show a alert and wait for the user to press the OK button.
const alertAsync = (message) => {
  return new Promise((resolve) => {
    Alert.alert(
      null,
      message,
      [
        {
          text: 'OK',
          onPress: () => resolve('OK Pressed'),
        },
      ],
      { cancelable: false },
    );
  });
};

export default alertAsync;
