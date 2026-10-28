import { Alert } from 'react-native';

import useModelVerification from './useModelVerification';

import MenuDivider from '@/components/popup-menu-options/MenuDivider';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useHaptics from '@/hooks/useHaptics';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

/**
 * A model's marks for `kind` as menu rows, a dot on what is set (an ai_admin tool): Verified, and
 * while verified whether it counts as uncensored (Venice's own label, or our override either way, the
 * same for every kind) and the two defaults. Used by the model list's row menu and the check screen's.
 */
export default function VerificationMenuOptions({ kind, model }) {
  const haptics = useHaptics();
  const { isVerified, uncensoredOverride, isVeniceUncensored, isDefault, setVerified, setUncensored, makeDefault } =
    useModelVerification(kind, model);

  async function change(changeAsync) {
    try {
      await changeAsync();
      haptics.selection();
    } catch (error) {
      haptics.error();
      Alert.alert("Couldn't change the model", apiErrorMessage(error));
    }
  }

  const setOverride = (uncensored) => () => {
    if (uncensoredOverride === uncensored) return;
    change(() => setUncensored(uncensored));
  };
  const setDefault = (variant) => () => {
    if (isDefault[variant]) return;
    change(() => makeDefault(variant));
  };

  return (
    <>
      <MenuOption
        label="Verified"
        icon="check-circle"
        active={isVerified}
        onPress={() => change(() => setVerified(!isVerified))}
      />
      {isVerified && (
        <>
          <MenuDivider />
          <MenuOption
            label={`Follow Venice: ${isVeniceUncensored ? 'uncensored' : 'not labelled'}`}
            icon="link"
            active={uncensoredOverride === null}
            onPress={setOverride(null)}
          />
          <MenuOption label="Uncensored" icon="eye" active={uncensoredOverride === true} onPress={setOverride(true)} />
          <MenuOption
            label="Not uncensored"
            icon="eye-off"
            active={uncensoredOverride === false}
            onPress={setOverride(false)}
          />
          <MenuDivider />
          <MenuOption label="Default model" icon="star" active={isDefault.regular} onPress={setDefault('regular')} />
          <MenuOption
            label="Default for Adult content"
            icon="flame"
            active={isDefault.unrestricted}
            onPress={setDefault('unrestricted')}
          />
        </>
      )}
    </>
  );
}
