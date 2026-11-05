import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActionButtons, { type ActionButtonsProps } from '@/components/ActionButtons';
import EditSheetHeader from '@/components/EditSheetHeader';
import { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { SCREEN_PADDING } from '@/constants';
import useKeyboardInset from '@/hooks/useKeyboardInset';

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
 * The sheet that edits one item as a draft (hooks/useEditSheet gives its props), under an
 * EditSheetHeader (×, the optional `title`, `confirmLabel`); while `isSaving` the actions are off too. The body (`children`) scrolls under
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
  const { bottom } = useSafeAreaInsets();

  const sheetActions = actions.map((action) => ({ ...action, disabled: action.disabled || isSaving }));
  const header = (
    <EditSheetHeader
      title={title}
      confirmLabel={confirmLabel}
      canConfirm={canConfirm}
      isSaving={isSaving}
      onCancel={onCancel}
      onConfirm={onConfirm}
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
type FillingBodyProps = { children?: ReactNode };
function FillingBody({ children }: FillingBodyProps) {
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
