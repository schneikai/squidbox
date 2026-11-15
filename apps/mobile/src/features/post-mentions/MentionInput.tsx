import { requireNativeView } from 'expo';
import { useCallback, useRef, useState, type Ref } from 'react';
import { StyleSheet, type HostInstance, type NativeSyntheticEvent, type ViewProps } from 'react-native';
// Not in the public API: how TextInput tells React Native which field has the keyboard.
import TextInputState from 'react-native/Libraries/Components/TextInput/TextInputState';

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
  /** The host view under Expo's wrapper (requireNativeViewManager's getNativeRef). */
  getNativeRef: () => HostInstance | null;
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
  // The host view as React Native's TextInputState knows it.
  const hostRef = useRef<HostInstance | null>(null);
  // The native view takes function calls only once it is on screen (before, iOS has no view for the
  // tag yet), which its first height report says: calls made earlier wait for it, and calls after the
  // view is gone do nothing.
  const mountedRef = useRef<Mounted | null>(null);
  NativeMentionInput ??= requireNativeView<NativeProps>('MentionInput');

  // The ref hands features one content object; the native function takes its two halves. One
  // callback while `ref` is the same, so React attaches it once, not on every render. The host is
  // registered with TextInputState as TextInput registers itself, so a tap outside the field
  // (a ScrollView's keyboardShouldPersistTaps) and Keyboard.dismiss() hide its keyboard: they blur it
  // with the view's `blur` command, which resigns the text view (MentionInputView.resignFirstResponder).
  const setNativeRef = useCallback(
    (native: NativeHandle | null) => {
      const host = native?.getNativeRef() ?? null;
      if (hostRef.current && hostRef.current !== host) {
        TextInputState.blurInput(hostRef.current);
        TextInputState.unregisterInput(hostRef.current);
      }
      if (host) TextInputState.registerInput(host);
      hostRef.current = host;
      if (mountedRef.current) mountedRef.current.isGone = true;
      const mounted = native ? newMounted() : null;
      mountedRef.current = mounted;
      const whenMounted = async (call: () => Promise<void>) => {
        await mounted?.ready;
        if (mounted && !mounted.isGone) await call();
      };
      const handle: MentionInputHandle | null = native && {
        setContent: (content) => whenMounted(() => native.setContent(content.text, content.mentions)),
        insertMention: (...args) => whenMounted(() => native.insertMention(...args)),
        focus: () => whenMounted(() => native.focus()),
      };
      if (typeof ref === 'function') ref(handle);
      else if (ref) ref.current = handle;
    },
    [ref],
  );

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
      onFocusChange={({ nativeEvent: { isFocused } }) => {
        if (isFocused) TextInputState.focusInput(hostRef.current);
        else TextInputState.blurInput(hostRef.current);
        onFocusChange?.(isFocused);
      }}
      onContentHeight={(event) => {
        mountedRef.current?.markReady();
        setHeight(event.nativeEvent.height);
      }}
      onMentionPress={(event) => onMentionPress?.(event.nativeEvent.id)}
      style={[styles.input, { height: Math.max(height, minHeight) }]}
    />
  );
}

type Mounted = { ready: Promise<void>; markReady: () => void; isGone: boolean };

function newMounted(): Mounted {
  let markReady = () => {};
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  return { ready, markReady, isGone: false };
}

const styles = StyleSheet.create({
  input: {
    alignSelf: 'stretch',
  },
});
