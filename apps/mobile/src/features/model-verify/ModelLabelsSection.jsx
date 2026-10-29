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
 * Unrestricted (with Venice's own rating), Default and Default for Adult content. A switch the
 * server would refuse is off limits, with the reason under its label; one switch is on its way to
 * the server at a time.
 */
export default function ModelLabelsSection({ kind, model }) {
  const haptics = useHaptics();
  const { isVerified, isUncensored, isVeniceUncensored, isDefault, setVerified, setUncensored, makeDefault } =
    useModelVerification(kind, model);
  // The switch on its way to the server, `{ label, isOn }`, null otherwise.
  const [pending, setPending] = useState(null);

  const isAnyDefault = isDefault.regular || isDefault.unrestricted;
  const veniceRating = isVeniceUncensored ? 'Venice rates it uncensored' : "Venice doesn't rate it uncensored";
  const labels = [
    {
      label: 'Verified',
      value: isVerified,
      reason: isDefault.regular
        ? "It's the Default"
        : isDefault.unrestricted
          ? "It's the Default for Adult content"
          : null,
      isLocked: isAnyDefault,
      change: (isOn) => setVerified(isOn),
    },
    {
      label: 'Unrestricted',
      value: isUncensored,
      description: veniceRating,
      reason: isDefault.unrestricted ? "It's the Default for Adult content" : null,
      isLocked: isDefault.unrestricted,
      change: (isOn) => setUncensored(isOn === isVeniceUncensored ? null : isOn),
    },
    {
      label: 'Default',
      value: isDefault.regular,
      reason: isVerified ? null : 'Turn on Verified first',
      isLocked: !isVerified || isDefault.regular,
      change: () => makeDefault('regular'),
    },
    {
      label: 'Default for Adult content',
      value: isDefault.unrestricted,
      reason: !isVerified ? 'Turn on Verified first' : !isUncensored ? 'Turn on Unrestricted first' : null,
      isLocked: !isVerified || !isUncensored || isDefault.unrestricted,
      change: () => makeDefault('unrestricted'),
    },
  ];

  async function handleChange({ label, change }, isOn) {
    setPending({ label, isOn });
    try {
      await change(isOn);
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
        {labels.map((each) => (
          <Row
            key={each.label}
            label={each.label}
            description={[each.description, each.reason].filter(Boolean).join(' · ') || undefined}
          >
            <Switch
              value={pending?.label === each.label ? pending.isOn : each.value}
              onValueChange={(isOn) => handleChange(each, isOn)}
              disabled={pending !== null || each.isLocked}
              accessibilityLabel={each.label}
            />
          </Row>
        ))}
      </Section>
      <SectionFooter>{modelKindText[kind].labelsFootnote}</SectionFooter>
    </>
  );
}
