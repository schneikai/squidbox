import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert } from 'react-native';

import featureText from './featureText';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import Switch from '@/components/Switch';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import useCloud from '@/features/cloud/useCloud';
import useCloseWhen from '@/hooks/useCloseWhen';
import useHasFeature from '@/hooks/useHasFeature';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import updateFeatureAsync from '@/utils/cloud-api/updateFeatureAsync';

// Settings → Features: the extras the signed-in account has on top of the defaults, a switch each.
// Only for an account with manage_features; a switch flips at once and goes back if the server says
// no.
export default function FeaturesScreen() {
  const navigation = useNavigation();
  const { user } = useCloud();
  const isAvailable = useHasFeature('manage_features');
  useCloseWhen(!isAvailable);
  // The switch on its way to the server, `{ feature, isOn }`, null otherwise.
  const [pending, setPending] = useState(null);

  const features = user?.features ?? [];

  function isFeatureOn(feature) {
    return pending?.feature === feature ? pending.isOn : features.includes(feature);
  }

  async function handleChange(feature, isOn) {
    setPending({ feature, isOn });
    try {
      await updateFeatureAsync(feature, isOn);
    } catch (error) {
      Alert.alert("Couldn't change the feature", apiErrorMessage(error));
    } finally {
      setPending(null);
    }
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Features" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <Section>
          {Object.entries(featureText).map(([feature, { title, description, requires }]) => (
            <Row key={feature} label={title} description={description}>
              <Switch
                value={isFeatureOn(feature)}
                onValueChange={(isOn) => handleChange(feature, isOn)}
                disabled={pending !== null || (requires !== undefined && !isFeatureOn(requires))}
                accessibilityLabel={title}
              />
            </Row>
          ))}
        </Section>
        <SectionFooter>
          Extras for {user?.email}. Your other devices pick a change up on their next launch.
        </SectionFooter>
      </DetailScrollView>
    </Page>
  );
}
