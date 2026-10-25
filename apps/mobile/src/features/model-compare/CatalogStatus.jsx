import { ActivityIndicator, StyleSheet, View } from 'react-native';

import EmptyState from '@/components/EmptyState';
import TextButton from '@/components/TextButton';
import { colors } from '@/styles/designTokens';

// Where Venice's models will be: a spinner while they load, or why they couldn't with Try again
// (`error` and `retry` from useAiCatalog).
export default function CatalogStatus({ error, retry }) {
  if (!error) return <ActivityIndicator style={styles.status} color={colors.text.secondary} />;
  return (
    <View style={styles.status}>
      <EmptyState icon="alert" title="Couldn't load the models" subtitle={error} />
      <TextButton label="Try again" onPress={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    paddingVertical: 40,
  },
});
