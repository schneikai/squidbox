import { StyleSheet, Text, View } from 'react-native';

import CardTextField from '@/components/CardTextField';
import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import TextButton from '@/components/TextButton';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { colors, scale, typography } from '@/styles/designTokens';

/**
 * A pushed screen that edits one text, the iOS Settings way: Back, the `title`, and a Textarea whose
 * text the screen stores as it changes (useSaveAsYouType; `onBlur` saves at once), with an optional
 * `description` under it and an optional `action` at the bottom (`{ label, tone, onPress }`, e.g.
 * Delete or Reset to default). No Save button.
 */
export default function TextEditScreen({
  title,
  value,
  onChangeText,
  onBlur,
  onBack,
  placeholder,
  maxLength,
  minHeight = scale(160),
  autoFocus = false,
  description,
  action,
}) {
  return (
    <Page>
      <FloatingDetailHeader title={title} onBack={onBack} />
      <DetailScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <CardTextField
          multiline
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          minHeight={minHeight}
          autoFocus={autoFocus}
        />
        {description != null && <Text style={styles.description}>{description}</Text>}
        {action && (
          <View style={styles.action}>
            <TextButton label={action.label} tone={action.tone} onPress={action.onPress} />
          </View>
        )}
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  description: {
    marginHorizontal: 4,
    fontSize: typography.footnote,
    color: colors.text.secondary,
  },
  action: {
    paddingTop: 24,
  },
});
