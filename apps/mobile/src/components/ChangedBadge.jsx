import { StyleSheet } from 'react-native';

import Badge from '@/components/Badge';

// "Changed" on a settings row whose setting differs from the app's default (an instruction, a
// kind's model picks), centred beside the row's label.
export default function ChangedBadge() {
  return <Badge label="Changed" tone="accent" style={styles.changed} />;
}

const styles = StyleSheet.create({
  changed: {
    alignSelf: 'center',
  },
});
