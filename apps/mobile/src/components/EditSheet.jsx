import { useNavigation, useNavigationState, useRoute } from '@react-navigation/native';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActionButtons from '@/components/ActionButtons';
import Button from '@/components/Button';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import { SCREEN_PADDING } from '@/constants';
import useKeyboardInset from '@/hooks/useKeyboardInset';
import useScrollY from '@/hooks/useScrollY';

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
  const { scrollY, onScroll } = useScrollY();
  const { bottom } = useSafeAreaInsets();
  const isSheetRoute = useIsSheetRoute();

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
      scrollY={scrollY}
      trailing={
        <Button
          variant="primary"
          size="small"
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
      <Animated.ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + SCREEN_PADDING }]}
      >
        {children}
        <ActionButtons actions={sheetActions} isScreenEnd />
      </Animated.ScrollView>
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

// Whether this screen is a sheet's own screen rather than a step pushed inside a sheet: a route of
// the root stack (an editor presented as a modal), or the first route of its stack (the post editor,
// first in its sheet's stack). Anything else is pushed inside a sheet (an editor opened from the
// post editor's chat, an album's notes inside the New post sheet), and leads with Back.
function useIsSheetRoute() {
  const navigation = useNavigation();
  const route = useRoute();
  const firstRouteKey = useNavigationState((state) => state.routes[0]?.key);
  return navigation.getParent() == null || firstRouteKey === route.key;
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
