import { StyleSheet } from 'react-native';

import CardTextField from '@/components/CardTextField';
import EditSheet from '@/components/EditSheet';
import IntroText from '@/components/IntroText';
import { scale } from '@/styles/designTokens';

/**
 * An EditSheet that edits one text: a Textarea (`value`, `onChangeText`, `placeholder`, `maxLength`,
 * `minHeight`, `autoFocus`) with an optional `description` under it. The other props go to EditSheet
 * (`title`, the props useEditSheet gives, `actions`).
 */
export default function TextEditSheet({
  value,
  onChangeText,
  placeholder,
  maxLength,
  minHeight = scale(160),
  autoFocus = false,
  description,
  ...sheetProps
}) {
  return (
    <EditSheet {...sheetProps}>
      <CardTextField
        multiline
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        maxLength={maxLength}
        minHeight={minHeight}
        autoFocus={autoFocus}
      />
      {description != null && <IntroText style={styles.description}>{description}</IntroText>}
    </EditSheet>
  );
}

const styles = StyleSheet.create({
  description: {
    marginHorizontal: 4,
  },
});
