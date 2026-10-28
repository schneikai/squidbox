import { Alert } from 'react-native';

import useModelVerification from './useModelVerification';

import MenuDivider from '@/components/popup-menu-options/MenuDivider';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import useHaptics from '@/hooks/useHaptics';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

/**
 * A model's marks for `kind` as menu rows, a dot on what is set (an ai_admin tool): Verified, and
 * while verified whether it counts as uncensored (Venice's own label, or our override either way) and
 * the two defaults. Used by the model list's row menu and the check screen's.
 */
export default function VerificationMenuOptions({ kind, model }) {
  const haptics = useHaptics();
  const { isVerified, unrestrictedMark, isVeniceUncensored, isDefault, setVerification, makeDefault } =
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

  const setMark = (isUnrestricted) => () => {
    if (unrestrictedMark === isUnrestricted) return;
    change(() => setVerification({ isVerified: true, isUnrestricted }));
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
        onPress={() => change(() => setVerification({ isVerified: !isVerified, isUnrestricted: null }))}
      />
      {isVerified && (
        <>
          <MenuDivider />
          <MenuOption
            label={`Follow Venice: ${isVeniceUncensored ? 'uncensored' : 'not labelled'}`}
            icon="link"
            active={unrestrictedMark === null}
            onPress={setMark(null)}
          />
          <MenuOption label="Uncensored" icon="eye" active={unrestrictedMark === true} onPress={setMark(true)} />
          <MenuOption
            label="Not uncensored"
            icon="eye-off"
            active={unrestrictedMark === false}
            onPress={setMark(false)}
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
