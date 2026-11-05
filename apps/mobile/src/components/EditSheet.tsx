import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import ActionButtons, { type ActionButtonsProps } from '@/components/ActionButtons';
import Button from '@/components/Button';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { SCREEN_PADDING } from '@/constants';
import useKeyboardInset from '@/hooks/useKeyboardInset';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSheetRoute from '@/hooks/useSheetRoute';
import { layout } from '@/styles/designTokens';

export type EditSheetProps = {
  title?: string;
  confirmLabel: string;
  canConfirm: boolean;
  isSaving?: boolean;
  onCancel: () => void;
  onConfirm?: () => void;
  actions?: ActionButtonsProps['actions'];
  isFilling?: boolean;
  children?: ReactNode;
};

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
  isSaving = false,
  onCancel,
  onConfirm,
  actions = [],
  isFilling = false,
  children,
}: EditSheetProps) {
  const padding = useScreenPadding('sheet');
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
        contentContainerStyle={[styles.content, padding]}
      >
        {children}
        <ActionButtons actions={sheetActions} isScreenEnd />
      </ScrollView>
    </ModalSheet>
  );
}

// The body that fills the sheet above the keyboard (`isFilling`).
type FillingBodyProps = { children?: ReactNode };
function FillingBody({ children }: FillingBodyProps) {
  const { paddingTop, paddingBottom } = useScreenPadding('sheet');
  const keyboardInset = useKeyboardInset();
  const fillingStyle = useAnimatedStyle(() => ({
    paddingTop,
    paddingBottom: Math.max(paddingBottom, keyboardInset.value),
  }));
  return <Animated.View style={[styles.filling, fillingStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: SCREEN_PADDING,
    gap: layout.cardGap,
  },
  filling: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  },
});
