import { CHAT_LIMITS } from '@squidbox/shared';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import Card from '@/components/Card';
import IconButton from '@/components/IconButton';
import Textarea from '@/components/Textarea';
import { colors, scale, sizes } from '@/styles/designTokens';

const MAX_INPUT_HEIGHT = scale(120);

/**
 * Where the user writes to the assistant: a text field, seeded with `seed` (`{ label, content }`, a
 * prompt button's, whose name goes with it until the text is edited), and Send, which hands
 * `onSend({ label, content })` the trimmed text and empties the field once it was sent. Send waits
 * while `isDisabled`, and shows a spinner while `isWaiting` (the send waits for the photos' tags).
 */
export default function ChatComposer({ seed, placeholder, isDisabled, isWaiting, onSend }) {
  const [text, setText] = useState(seed?.content ?? '');
  const [label, setLabel] = useState(seed?.label ?? null);

  const content = text.trim();
  const canSend = Boolean(content) && !isDisabled && !isWaiting;

  function handleChangeText(next) {
    setText(next);
    setLabel(null);
  }

  async function handleSend() {
    if (!canSend) return;
    const isSent = await onSend({ label, content });
    if (!isSent) return;
    setText('');
    setLabel(null);
  }

  return (
    <Card style={styles.composer}>
      <Textarea
        value={text}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        maxLength={CHAT_LIMITS.message}
        scrollEnabled
        style={styles.input}
        accessibilityLabel="Message"
      />
      <View style={styles.send}>
        {isWaiting ? (
          <ActivityIndicator color={colors.accent.base} accessibilityLabel="Looking at the photos" />
        ) : (
          <IconButton
            icon="arrow-up"
            variant="primary"
            onPress={handleSend}
            disabled={!canSend}
            accessibilityLabel="Send"
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: sizes.iconButton / 2 + 6,
    padding: 6,
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    maxHeight: MAX_INPUT_HEIGHT,
    paddingTop: 10,
    paddingBottom: 10,
  },
  send: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
