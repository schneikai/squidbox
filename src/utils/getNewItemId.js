import uuid from 'react-native-uuid';

// TODO: Since we allow syncing data of different accounts it would
// probably a good idea to prefix the id with the account id to
// avoid generating duplicated ids.

export default function getNewItemId() {
  return uuid.v4().replace(/-/g, '');
}
