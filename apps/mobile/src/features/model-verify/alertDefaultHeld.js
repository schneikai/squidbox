import { Alert } from 'react-native';

/**
 * Says why a model can't be removed, or its default turned off, while it is a default: `name` the
 * model's, `defaultName` the default it is.
 */
export default function alertDefaultHeld(name, defaultName) {
  Alert.alert(`${name} is the ${defaultName}`, `Make another model the ${defaultName} first.`);
}
