import { ScrollView, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActionButtons from '@/components/ActionButtons';
import Button from '@/components/Button';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { SCREEN_PADDING } from '@/constants';
import useKeyboardInset from '@/hooks/useKeyboardInset';
import useSheetRoute from '@/hooks/useSheetRoute';

/**
 * The sheet that edits one item as a draft (hooks/useEditSheet gives its props): × on the leading
 * side to cancel (Back when pushed inside another sheet), the optional `title`, and `confirmLabel`
 * (Add for a new item, Save for an edit) on the trailing side, off unless `canConfirm`, with a
 * spinner while `isSaving`, when × and the actions are off too. The body (`children`) scrolls under
 * the header, with optional `actions` at its end (ActionButtons: `{ label, colorPalette, onPress,
 * loading, disabled }`, e.g. Delete). `isFilling` lets the body fill the sheet above the keyboard instead of scrolling, for
 * a text field that fills it (TextEditSheet).
 */
export default function EditSheet({
  title,
  confirmLabel,
  canConfirm,
  isSaving,
  onCancel,
  onConfirm,
  actions = [],
  isFilling = false,
  children,
}) {
  const { bottom } = useSafeAreaInsets();
  const isSheetRoute = useSheetRoute()?.isFirstScreen ?? true;

  const sheetActions = actions.map((action) => ({ ...action, disabled: action.disabled || isSaving }));
  const header = (
    <ModalHeader
      leading={
        <Button
          icon={isSheetRoute ? 'close' : 'chevron-left'}
          accessibilityLabel={isSheetRoute ? 'Close' : 'Back'}
          onPress={onCancel}
          disabled={isSaving}
        />
      }
      title={title}
      trailing={
        <Button
          variant="primary"
          label={confirmLabel}
          onPress={onConfirm}
          disabled={!canConfirm || isSaving}
          loading={isSaving}
        />
      }
    />
  );

  if (isFilling) {
    return (
      <ModalSheet>
        {header}
        <FillingBody>
          {children}
          <ActionButtons actions={sheetActions} isScreenEnd />
        </FillingBody>
      </ModalSheet>
    );
  }

  return (
    <ModalSheet>
      {header}
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + SCREEN_PADDING }]}
      >
        {children}
        <ActionButtons actions={sheetActions} isScreenEnd />
      </ScrollView>
    </ModalSheet>
  );
}

// The body that fills the sheet above the keyboard (`isFilling`).
function FillingBody({ children }) {
  const { bottom } = useSafeAreaInsets();
  const keyboardInset = useKeyboardInset(12);
  const fillingStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(bottom + SCREEN_PADDING, keyboardInset.value),
  }));
  return <Animated.View style={[styles.filling, fillingStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  content: {
    paddingTop: MODAL_HEADER_HEIGHT + SCREEN_PADDING,
    paddingHorizontal: SCREEN_PADDING,
    gap: 12,
  },
  filling: {
    flex: 1,
    paddingTop: MODAL_HEADER_HEIGHT + SCREEN_PADDING,
    paddingHorizontal: SCREEN_PADDING,
  },
});
