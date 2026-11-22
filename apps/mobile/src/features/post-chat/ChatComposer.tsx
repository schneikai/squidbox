import { CHAT_LIMITS } from '@squidbox/shared';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import type { ChatSeed } from './chatSessions';

import Button from '@/components/Button';
import EdgeFade from '@/components/EdgeFade';
import FoldingTextInput from '@/components/FoldingTextInput';
import GlassSurface from '@/components/GlassSurface';
import { colors, layout, scale, sizes, space } from '@/styles/designTokens';

const MAX_INPUT_HEIGHT = scale(120);

type ChatComposerProps = {
  seed?: ChatSeed;
  placeholder: string;
  disabled: boolean;
  isWaiting: boolean;
  onSend: (seed: Required<ChatSeed>) => boolean;
  accessory?: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * Where the user writes to the assistant: a text field, one line while not typing, seeded with
 * `seed` (`{ label, content }`, a prompt button's, whose name goes with it until the text is
 * edited; the field then opens in full for typing), and Send, which hands `onSend({ label, content })` the trimmed text and empties the field
 * once the turn is in the chat. Send waits while `disabled`, and shows a spinner while `isWaiting`
 * (the send waits for the photos' tags). It floats over the chat on frosted glass: the text on top,
 * and under it `accessory` (the prompt buttons) beside Send. `onLayout` reports its size, so the
 * chat can keep its end clear of it.
 */
export default function ChatComposer({
  seed,
  placeholder,
  disabled,
  isWaiting,
  onSend,
  accessory,
  onLayout,
}: ChatComposerProps) {
  const [text, setText] = useState(seed?.content ?? '');
  const [label, setLabel] = useState(seed?.label ?? null);

  const content = text.trim();
  const canSend = Boolean(content) && !disabled;

  function handleChangeText(next: string) {
    setText(next);
    setLabel(null);
  }

  function handleSend() {
    if (!canSend || !onSend({ label, content })) return;
    setText('');
    setLabel(null);
  }

  return (
    <GlassSurface radius={RADIUS} contentStyle={styles.surface} onLayout={onLayout}>
      <FoldingTextInput
        foldedLines={1}
        editHint="Writes a message"
        isInitiallyEditing={!!seed}
        value={text}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        maxLength={CHAT_LIMITS.message}
        style={styles.input}
        accessibilityLabel="Message"
      />
      <View style={styles.bar}>
        <View style={styles.accessory}>
          {accessory}
          {/* The chips scroll out under a fade before Send, not against a hard edge. */}
          <EdgeFade
            color={colors.background.litGlass}
            clearColor={colors.background.litGlassClear}
            width={layout.composerFade}
          />
        </View>
        <View style={styles.send}>
          {isWaiting ? (
            <ActivityIndicator color={colors.accent.base} accessibilityLabel="Looking at the photos" />
          ) : (
            <Button
              icon="arrow-up"
              variant="primary"
              onPress={handleSend}
              disabled={!canSend}
              accessibilityLabel="Send"
            />
          )}
        </View>
      </View>
    </GlassSurface>
  );
}

// Concentric with the send disc in its corner.
const RADIUS = sizes.iconButton / 2 + space.sm;

const styles = StyleSheet.create({
  surface: {
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.sm,
  },
  input: {
    maxHeight: MAX_INPUT_HEIGHT,
    paddingHorizontal: space.lg,
    paddingVertical: 0,
  },
  // The prompt buttons scroll to the glass's edge on the left, Send keeps the inset on the right.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingRight: space.sm,
  },
  accessory: {
    flex: 1,
    minWidth: 0,
  },
  send: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
