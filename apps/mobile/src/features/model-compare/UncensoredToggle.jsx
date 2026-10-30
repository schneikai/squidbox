import { MODEL_LABEL_NAMES } from '@squidbox/shared';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import useAiCatalog from '@/hooks/useAiCatalog';
import useHaptics from '@/hooks/useHaptics';
import applyAiCatalog from '@/lib/applyAiCatalog';
import { colors, radii, scale, typography } from '@/styles/designTokens';
import findCatalogModel from '@/utils/ai/findCatalogModel';
import setUncensoredAsync from '@/utils/cloud-api/ai/setUncensoredAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

const SIZE = scale(32);
// To Apple's 44pt tap target.
const HIT_SLOP = (scale(44) - SIZE) / 2;

/**
 * A compare card's Uncensored label for the model `modelId`, the same mark as the switch on the
 * model's page (every account sees it), on or off with one tap whether its name is shown or not.
 * It turns at once: taps made while one is on its way are sent after it, the last one winning.
 */
export default function UncensoredToggle({ modelId }) {
  const haptics = useHaptics();
  const { models } = useAiCatalog();
  // What the user last tapped, until the server has it; null while nothing is on its way.
  const [wanted, setWanted] = useState(null);
  const wantedRef = useRef(null);
  const isSendingRef = useRef(false);

  const model = findCatalogModel(models, modelId);
  const isOn = wanted ?? model?.isUncensored ?? false;

  async function send() {
    isSendingRef.current = true;
    try {
      while (wantedRef.current !== null) {
        const next = wantedRef.current;
        // Back to following Venice when it agrees.
        applyAiCatalog(await setUncensoredAsync(modelId, next === model.isVeniceUncensored ? null : next));
        if (wantedRef.current === next) wantedRef.current = null;
      }
    } catch (error) {
      wantedRef.current = null;
      haptics.error();
      Alert.alert("Couldn't change the label", apiErrorMessage(error));
    } finally {
      isSendingRef.current = false;
      setWanted(wantedRef.current);
    }
  }

  function handlePress() {
    wantedRef.current = !isOn;
    setWanted(!isOn);
    haptics.selection();
    if (!isSendingRef.current) send();
  }

  if (!model) return null;

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={HIT_SLOP}
      accessibilityRole="switch"
      accessibilityLabel={MODEL_LABEL_NAMES.uncensored}
      accessibilityState={{ checked: isOn }}
      style={({ pressed }) => [styles.toggle, isOn && styles.on, pressed && styles.pressed]}
    >
      <Text style={[styles.text, isOn && styles.textOn]}>18+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: {
    backgroundColor: colors.accent.base,
    borderColor: colors.accent.base,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  text: {
    fontSize: typography.caption2,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  textOn: {
    color: colors.text.inverse,
  },
});
