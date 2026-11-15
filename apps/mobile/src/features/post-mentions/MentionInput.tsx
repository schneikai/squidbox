import { requireNativeView } from 'expo';
import { useState, type Ref } from 'react';
import { StyleSheet, type NativeSyntheticEvent, type ViewProps } from 'react-native';

import type { FieldContent } from './fieldContent';
import { mentionChipStyle, type MentionChipStyle } from './mentionChipStyle';

import { colors, textStyles } from '@/styles/designTokens';

/** Where the cursor is in the field's text: a collapsed selection has `start === end`. */
export type FieldSelection = { start: number; end: number };

export type MentionInputHandle = {
  /** Replaces the field's text and chips, the cursor at the end; reported back by no event. */
  setContent: (content: FieldContent) => Promise<void>;
  /** Puts the contact's chip and a space in place of the text from `start` to `end`. */
  insertMention: (id: string, label: string, avatarUri: string | null, start: number, end: number) => Promise<void>;
  focus: () => Promise<void>;
};

export type MentionInputProps = {
  ref?: Ref<MentionInputHandle>;
  placeholder?: string;
  /** The field's height while its text needs less. */
  minHeight: number;
  /** The text and chips after the user changed them (or a chip was inserted), and the selection. */
  onChangeContent: (content: FieldContent, selection: FieldSelection) => void;
  onSelectionChange: (selection: FieldSelection) => void;
  onFocusChange?: (isFocused: boolean) => void;
  /** A tapped chip's contact id. */
  onMentionPress?: (id: string) => void;
};

type NativeContent = FieldContent & FieldSelection;
type NativeProps = ViewProps & {
  ref?: Ref<NativeHandle>;
  placeholder?: string;
  fontSize?: number;
  lineHeight?: number;
  textColor?: string;
  placeholderColor?: string;
  chipColor?: string;
  chipStyle?: MentionChipStyle;
  onChangeContent?: (event: NativeSyntheticEvent<NativeContent>) => void;
  onSelectionChange?: (event: NativeSyntheticEvent<FieldSelection>) => void;
  onFocusChange?: (event: NativeSyntheticEvent<{ isFocused: boolean }>) => void;
  onContentHeight?: (event: NativeSyntheticEvent<{ height: number }>) => void;
  onMentionPress?: (event: NativeSyntheticEvent<{ id: string }>) => void;
};
// The native view's functions take the content as two arguments.
type NativeHandle = Omit<MentionInputHandle, 'setContent'> & {
  setContent: (text: string, mentions: FieldContent['mentions']) => Promise<void>;
};

// Looked up at the first render, not at import: only an iOS build with the module has it.
let NativeMentionInput: React.ComponentType<NativeProps> | undefined;

/**
 * The mention field on iOS: a multiline text field whose mentions are chips inside the text
 * (modules/mention-input), each chip one MENTION_CHIP in its text. It grows with its text. Which @ is
 * being typed is not its concern (mentionAt over the text and selection it reports). The web has a
 * stand-in with the same props and ref (MentionInput.web.tsx).
 */
export default function MentionInput({
  ref,
  placeholder,
  minHeight,
  onChangeContent,
  onSelectionChange,
  onFocusChange,
  onMentionPress,
}: MentionInputProps) {
  const [height, setHeight] = useState(0);
  NativeMentionInput ??= requireNativeView<NativeProps>('MentionInput');

  // The ref hands features one content object; the native function takes its two halves.
  function setNativeRef(native: NativeHandle | null) {
    const handle: MentionInputHandle | null = native && {
      setContent: (content) => native.setContent(content.text, content.mentions),
      insertMention: (...args) => native.insertMention(...args),
      focus: () => native.focus(),
    };
    if (typeof ref === 'function') ref(handle);
    else if (ref) ref.current = handle;
  }

  return (
    <NativeMentionInput
      ref={setNativeRef}
      placeholder={placeholder}
      fontSize={textStyles.reading.fontSize}
      lineHeight={textStyles.reading.lineHeight}
      textColor={colors.text.primary}
      placeholderColor={colors.text.tertiary}
      chipColor={colors.background.muted}
      chipStyle={mentionChipStyle}
      onChangeContent={({ nativeEvent: { text, mentions, start, end } }) =>
        onChangeContent({ text, mentions }, { start, end })
      }
      onSelectionChange={({ nativeEvent: { start, end } }) => onSelectionChange({ start, end })}
      onFocusChange={(event) => onFocusChange?.(event.nativeEvent.isFocused)}
      onContentHeight={(event) => setHeight(event.nativeEvent.height)}
      onMentionPress={(event) => onMentionPress?.(event.nativeEvent.id)}
      style={[styles.input, { height: Math.max(height, minHeight) }]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    alignSelf: 'stretch',
  },
});
