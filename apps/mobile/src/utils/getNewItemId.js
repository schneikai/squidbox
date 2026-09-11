import uuid from 'react-native-uuid';

// Canonical uuid v4. (Historically this stripped the dashes, producing 32-char hex ids; the
// backend now uses a real `uuid` column and legacy ids were canonicalized on import, so new ids
// are standard dashed uuids too.)
export default function getNewItemId() {
  return uuid.v4();
}
