import { MODEL_LABEL_NAMES } from '@squidbox/shared';
import { useState } from 'react';
import { Alert } from 'react-native';

import useModelVerification from './useModelVerification';

import Switch from '@/components/Switch';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import modelKindText from '@/features/model-compare/modelKindText';
import useHaptics from '@/hooks/useHaptics';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

/**
 * A catalog model's labels for `kind`, a switch each, as every account sees them: Verified,
 * Unrestricted (with Venice's own rating), Default and Default for Adult content. Every switch
 * works the same on every model: turning on a default turns on what it needs (the server does that),
 * and turning off a label a default keeps on (modelLabelLocks) says which default to move first, like
 * Remove. One switch is on its way to the server at a time.
 */
export default function ModelLabelsSection({ kind, model }) {
  const haptics = useHaptics();
  const { labels, locks, isVeniceUncensored, setVerified, setUncensored, makeDefault } = useModelVerification(
    kind,
    model.id,
    model,
  );
  // The switch on its way to the server, `{ label, isOn }`, null otherwise.
  const [pending, setPending] = useState(null);

  const changes = {
    verified: (isOn) => setVerified(isOn),
    unrestricted: (isOn) => setUncensored(isOn === isVeniceUncensored ? null : isOn),
    default: () => makeDefault('regular'),
    adultDefault: () => makeDefault('unrestricted'),
  };
  const veniceRating = isVeniceUncensored ? 'Venice rates it unrestricted' : "Venice doesn't rate it unrestricted";

  async function handleChange(label, isOn) {
    const { defaultName } = locks[label];
    if (!isOn && defaultName) {
      Alert.alert(`${model.name} is the ${defaultName}`, `Make another model the ${defaultName} first.`);
      return;
    }
    setPending({ label, isOn });
    try {
      await changes[label](isOn);
      haptics.selection();
    } catch (error) {
      haptics.error();
      Alert.alert("Couldn't change the label", apiErrorMessage(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Section isHeaderless>
        {Object.keys(changes).map((label) => (
          <Row
            key={label}
            label={MODEL_LABEL_NAMES[label]}
            description={label === 'unrestricted' ? veniceRating : undefined}
          >
            <Switch
              value={pending?.label === label ? pending.isOn : labels[label]}
              onValueChange={(isOn) => handleChange(label, isOn)}
              disabled={pending !== null || !locks}
              accessibilityLabel={MODEL_LABEL_NAMES[label]}
            />
          </Row>
        ))}
      </Section>
      <SectionFooter>{modelKindText[kind].labelsFootnote}</SectionFooter>
    </>
  );
}
