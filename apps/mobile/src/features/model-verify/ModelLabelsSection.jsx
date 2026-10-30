import { MODEL_DEFAULT_LABELS, MODEL_LABEL_NAMES } from '@squidbox/shared';
import { useState } from 'react';
import { Alert } from 'react-native';

import alertDefaultHeld from './alertDefaultHeld';

import Switch from '@/components/Switch';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import modelKindText from '@/features/model-compare/modelKindText';
import useHaptics from '@/hooks/useHaptics';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

/**
 * A catalog model's labels for `kind`, a switch each: Verified and Uncensored (with Venice's own
 * rating), marks every account sees, and Default and Uncensored default, this account's picks until
 * Apply changes for everyone in the list. Each is a flag of its own: making a model a default
 * changes no other label, and a default's Verified and Uncensored turn off like any other model's.
 * Turning a default off goes back to the published one; on the published default itself there is
 * nothing to go back to, so it says so, like Remove. One switch is on its way at a time.
 * `verification` is the model's useModelVerification.
 */
export default function ModelLabelsSection({ kind, model, verification }) {
  const haptics = useHaptics();
  const { labels, isVeniceUncensored, isPublishedDefault, setVerified, setUncensored, setDefault } = verification;
  // The switch on its way to the server, `{ label, isOn }`, null otherwise.
  const [pending, setPending] = useState(null);

  const changes = {
    verified: (isOn) => setVerified(isOn),
    uncensored: (isOn) => setUncensored(isOn === isVeniceUncensored ? null : isOn),
    default: (isOn) => setDefault(MODEL_DEFAULT_LABELS.default, isOn),
    uncensoredDefault: (isOn) => setDefault(MODEL_DEFAULT_LABELS.uncensoredDefault, isOn),
  };
  const veniceRating = isVeniceUncensored ? 'Venice rates it uncensored' : "Venice doesn't rate it uncensored";

  async function handleChange(label, isOn) {
    if (!isOn && label in MODEL_DEFAULT_LABELS && isPublishedDefault(MODEL_DEFAULT_LABELS[label])) {
      alertDefaultHeld(model.name, MODEL_LABEL_NAMES[label]);
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
            description={label === 'uncensored' ? veniceRating : undefined}
          >
            <Switch
              value={pending?.label === label ? pending.isOn : labels[label]}
              onValueChange={(isOn) => handleChange(label, isOn)}
              disabled={pending !== null}
              accessibilityLabel={MODEL_LABEL_NAMES[label]}
            />
          </Row>
        ))}
      </Section>
      <SectionFooter>{modelKindText[kind].labelsFootnote}</SectionFooter>
    </>
  );
}
