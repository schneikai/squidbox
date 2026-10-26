import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Card from '@/components/Card';
import DetailScrollView from '@/components/DetailScrollView';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import TextButton from '@/components/TextButton';
import Textarea from '@/components/Textarea';
import { SCREEN_PADDING } from '@/constants';
import { colors, scale, typography } from '@/styles/designTokens';

/**
 * A modal sheet that edits one text: × to close, the `title`, and Save (`canSave`, `isSaving`,
 * `onSave`) over a Textarea, with an optional `description` under it and an optional `action` at the
 * bottom (`{ label, tone, onPress }`, e.g. Delete or Reset to default). The screen owns the text and
 * what Save does.
 */
export default function TextEditSheet({
  title,
  value,
  onChangeText,
  placeholder,
  maxLength,
  minHeight = scale(160),
  autoFocus = false,
  description,
  action,
  canSave,
  isSaving = false,
  onSave,
  onClose,
}) {
  const { bottom } = useSafeAreaInsets();

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={onClose} />}
        centerSlot={title}
        rightSlot={
          <PrimaryButton size="compact" label="Save" onPress={onSave} disabled={!canSave} loading={isSaving} />
        }
      />
      <DetailScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + SCREEN_PADDING }]}
      >
        <Card>
          <Textarea
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            maxLength={maxLength}
            minHeight={minHeight}
            autoFocus={autoFocus}
            style={styles.input}
          />
        </Card>
        {description != null && <Text style={styles.description}>{description}</Text>}
        {action && (
          <View style={styles.action}>
            <TextButton label={action.label} tone={action.tone} onPress={action.onPress} />
          </View>
        )}
      </DetailScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: MODAL_HEADER_HEIGHT + 8,
    gap: 12,
  },
  input: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  description: {
    marginHorizontal: 4,
    fontSize: typography.footnote,
    color: colors.text.secondary,
  },
  action: {
    marginTop: 'auto',
    paddingTop: 24,
  },
});
