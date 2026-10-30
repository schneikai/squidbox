import { ActivityIndicator, StyleSheet, View } from 'react-native';

import EmptyState from '@/components/EmptyState';
import TextButton from '@/components/TextButton';
import { colors } from '@/styles/designTokens';

// Where Venice's models (or what else loads from the server) will be: a spinner while they load, or
// `title` and why they couldn't with Try again (`error` and `retry`, as useAiCatalog has them).
export default function CatalogStatus({ title = "Couldn't load the models", error, retry }) {
  if (!error) return <ActivityIndicator style={styles.status} color={colors.text.secondary} />;
  return (
    <View style={styles.status}>
      <EmptyState icon="alert" title={title} subtitle={error} />
      <TextButton label="Try again" onPress={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    paddingVertical: 40,
  },
});
