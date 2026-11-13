import type { UpdateFeaturesRequest } from '@squidbox/shared';
import { useNavigation } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import featureSwitchRows from './featureSwitchRows';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import Switch from '@/components/Switch';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import useCloseWhen from '@/hooks/useCloseWhen';
import useHasFeature from '@/hooks/useHasFeature';
import useCloud from '@/providers/cloud/useCloud';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import updateFeatureAsync from '@/utils/cloud-api/updateFeatureAsync';

// Settings → Features: the extras the signed-in account has on top of the defaults, a switch each.
// Only for a developer account; a switch flips at once and goes back if the server says
// no.
export default function FeaturesScreen() {
  const navigation = useNavigation();
  const { user } = useCloud();
  const isAvailable = useHasFeature('developer');
  useCloseWhen(!isAvailable);
  // The switch on its way to the server, null otherwise.
  const [pending, setPending] = useState<UpdateFeaturesRequest | null>(null);

  const rows = featureSwitchRows(user?.features ?? [], pending);

  async function handleChange(feature: UpdateFeaturesRequest['feature'], isOn: boolean) {
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
          {rows.map((row) => (
            <Row key={row.feature} label={row.title} description={row.description}>
              <Switch
                value={row.isOn}
                onValueChange={(isOn) => handleChange(row.feature, isOn)}
                disabled={row.isDisabled}
                accessibilityLabel={row.title}
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
