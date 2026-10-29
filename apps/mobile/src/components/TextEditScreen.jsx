import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

import CardTextField from '@/components/CardTextField';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import TextButton from '@/components/TextButton';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { SCREEN_PADDING } from '@/constants';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout } from '@/styles/designTokens';

/**
 * A pushed screen that edits one text, the iOS Settings way: Back, the `title`, and a Textarea whose
 * text the screen stores as it changes (useSaveAsYouType; `onBlur` saves at once), with an optional
 * `description` over it and an optional `action` at the bottom (`{ label, tone, onPress }`, e.g.
 * Delete or Reset to default). No Save button. The Textarea fills the screen above the keyboard and
 * scrolls its text inside, as in Notes: a drag scrolls, a tap edits.
 */
export default function TextEditScreen({
  title,
  value,
  onChangeText,
  onBlur,
  onBack,
  placeholder,
  maxLength,
  autoFocus = false,
  description,
  action,
}) {
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const keyboard = useAnimatedKeyboard();

  const contentStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(paddingBottom, keyboard.height.value + 12),
  }));

  return (
    <Page>
      <FloatingDetailHeader title={title} onBack={onBack} />
      <Animated.View style={[styles.content, { paddingTop }, contentStyle]}>
        {description != null && <IntroText style={styles.description}>{description}</IntroText>}
        <CardTextField
          multiline
          isFilling
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={autoFocus}
        />
        {action && (
          <View style={styles.action}>
            <TextButton label={action.label} tone={action.tone} onPress={action.onPress} />
          </View>
        )}
      </Animated.View>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
    // The gap every screen's intro text has to what follows it.
    gap: layout.introGap,
  },
  description: {
    marginHorizontal: 4,
  },
  action: {
    paddingTop: 12,
  },
});
