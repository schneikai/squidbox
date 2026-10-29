import { useNavigation, useNavigationState, useRoute } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import TextButton from '@/components/TextButton';
import { SCREEN_PADDING } from '@/constants';
import useScrollY from '@/hooks/useScrollY';

/**
 * The sheet that edits one item as a draft (hooks/useEditSheet gives its props): × on the
 * leading side to cancel (Back when pushed inside another sheet), the optional `title`, and `confirmLabel`
 * (Add for a new item, Save for an edit) on the trailing side, off unless `canConfirm`, with a
 * spinner while `isSaving`. The body (`children`) scrolls under the header, with optional `actions`
 * (`[{ label, tone, onPress }]`, e.g. Delete) as text buttons at the bottom, off while `isSaving`.
 */
export default function EditSheet({
  title,
  confirmLabel,
  canConfirm,
  isSaving,
  onCancel,
  onConfirm,
  actions,
  children,
}) {
  const { scrollY, onScroll } = useScrollY();
  const { bottom } = useSafeAreaInsets();
  const isSheetRoute = useIsSheetRoute();

  return (
    <ModalSheet>
      <ModalHeader
        leftSlot={<ModalCloseButton kind={isSheetRoute ? 'close' : 'back'} onPress={onCancel} />}
        centerSlot={title}
        scrollY={scrollY}
        rightSlot={
          <PrimaryButton
            size="compact"
            label={confirmLabel}
            onPress={onConfirm}
            disabled={!canConfirm || isSaving}
            loading={isSaving}
          />
        }
      />
      <Animated.ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + SCREEN_PADDING }]}
      >
        {children}
        {actions?.length > 0 && (
          <View style={styles.actions}>
            {actions.map((action) => (
              <TextButton
                key={action.label}
                label={action.label}
                tone={action.tone}
                onPress={action.onPress}
                disabled={isSaving}
              />
            ))}
          </View>
        )}
      </Animated.ScrollView>
    </ModalSheet>
  );
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
  actions: {
    paddingTop: 24,
  },
});
