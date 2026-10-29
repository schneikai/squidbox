import { Alert } from 'react-native';

/**
 * Says why a model's label or the model itself can't go while it is a default: `name` the model's,
 * `defaultName` the default it is (modelLabelLocks' `defaultName`).
 */
export default function alertDefaultHeld(name, defaultName) {
  Alert.alert(`${name} is the ${defaultName}`, `Make another model the ${defaultName} first.`);
}
