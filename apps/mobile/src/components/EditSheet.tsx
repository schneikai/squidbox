import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import ActionButtons, { type ActionButtonsProps } from '@/components/ActionButtons';
import EditSheetHeader from '@/components/EditSheetHeader';
import ModalSheet from '@/components/ModalSheet';
import { SCREEN_PADDING } from '@/constants';
import useKeyboardInset from '@/hooks/useKeyboardInset';
import useScreenPadding from '@/hooks/useScreenPadding';
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
  testID?: string;
  children?: ReactNode;
};

/**
 * The sheet that edits one item as a draft (hooks/useEditSheet gives its props), under an
 * EditSheetHeader (×, the optional `title`, `confirmLabel`); while `isSaving` the actions are off too. The body (`children`) scrolls under
 * the header, with optional `actions` at its end (ActionButtons: `{ label, colorPalette, onPress,
 * loading, disabled }`, e.g. Delete). `isFilling` lets the body fill the sheet above the keyboard instead of scrolling, for
 * a text field that fills it (TextEditSheet). `testID` names the sheet for the UI flow tests.
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
  testID,
  children,
}: EditSheetProps) {
  const padding = useScreenPadding('sheet');

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
      <ModalSheet testID={testID}>
        {header}
        <FillingBody>
          {children}
          <ActionButtons actions={sheetActions} isScreenEnd />
        </FillingBody>
      </ModalSheet>
    );
  }

  return (
    <ModalSheet testID={testID}>
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
