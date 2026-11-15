import { requireNativeView } from 'expo';
import { useState, type Ref } from 'react';
import { StyleSheet, type NativeSyntheticEvent, type ViewProps } from 'react-native';

import { colors, scale, textStyles } from '@/styles/designTokens';

/** A mention in the field's text: the contact's id, its chip's label, and where it is in `text`. */
export type MentionInputMention = { id: string; label: string; location: number };
/** The field's text, each mention as one U+FFFC character at its `location`. */
export type MentionInputContent = { text: string; mentions: MentionInputMention[] };
export type MentionInputHandle = {
  insertMention: (id: string, label: string, avatarUri: string | null) => Promise<void>;
  focus: () => Promise<void>;
};

type NativeProps = ViewProps & {
  ref?: Ref<MentionInputHandle>;
  placeholder?: string;
  fontSize?: number;
  lineHeight?: number;
  textColor?: string;
  placeholderColor?: string;
  chipColor?: string;
  onChangeContent?: (event: NativeSyntheticEvent<MentionInputContent>) => void;
  onMentionQuery?: (event: NativeSyntheticEvent<{ isActive: boolean; query: string }>) => void;
  onContentHeight?: (event: NativeSyntheticEvent<{ height: number }>) => void;
  onMentionPress?: (event: NativeSyntheticEvent<{ id: string }>) => void;
};

// Looked up at the first render, not at import: only an iOS build with the module has it.
let NativeMentionInput: React.ComponentType<NativeProps> | undefined;

export type MentionInputProps = {
  ref?: Ref<MentionInputHandle>;
  placeholder?: string;
  onChangeContent: (content: MentionInputContent) => void;
  onMentionQuery: (query: string | null) => void;
  onMentionPress?: (id: string) => void;
};

/**
 * SPIKE (iOS): a multiline text field whose mentions are chips inside the text (modules/mention-input).
 * `onMentionQuery` gets what follows the @ being typed (null when none is); `ref.insertMention` puts a
 * contact's chip there. `onChangeContent` gets the text and its mentions, `onMentionPress` a tapped
 * chip's contact id. It grows with its text.
 */
export default function MentionInput({
  ref,
  placeholder,
  onChangeContent,
  onMentionQuery,
  onMentionPress,
}: MentionInputProps) {
  const [height, setHeight] = useState(0);
  NativeMentionInput ??= requireNativeView<NativeProps>('MentionInput');

  return (
    <NativeMentionInput
      ref={ref}
      placeholder={placeholder}
      fontSize={textStyles.reading.fontSize}
      lineHeight={textStyles.reading.lineHeight}
      textColor={colors.text.primary}
      placeholderColor={colors.text.tertiary}
      chipColor={colors.background.muted}
      onChangeContent={(event) => onChangeContent(event.nativeEvent)}
      onMentionQuery={({ nativeEvent }) => onMentionQuery(nativeEvent.isActive ? nativeEvent.query : null)}
      onContentHeight={(event) => setHeight(event.nativeEvent.height)}
      onMentionPress={(event) => onMentionPress?.(event.nativeEvent.id)}
      style={[styles.input, { height: Math.max(height, MIN_HEIGHT) }]}
    />
  );
}

const MIN_HEIGHT = scale(84);

const styles = StyleSheet.create({
  input: {
    alignSelf: 'stretch',
  },
});
