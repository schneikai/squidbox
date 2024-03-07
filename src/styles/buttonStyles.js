import { StyleSheet } from 'react-native';

const buttonBase = {
  borderColor: 'black',
  borderWidth: 2,
  padding: 5,
  alignItems: 'center',
};

const buttonTextBase = {
  fontWeight: 'bold',
  color: 'black',
};

export default StyleSheet.create({
  button: buttonBase,
  buttonText: buttonTextBase,

  buttonPrimary: {
    ...buttonBase,
    borderColor: 'blue',
  },
  buttonPrimaryText: {
    ...buttonTextBase,
    color: 'blue',
  },

  buttonDanger: {
    ...buttonBase,
    borderColor: 'red',
  },
  buttonDangerText: {
    ...buttonTextBase,
    color: 'red',
  },
});
