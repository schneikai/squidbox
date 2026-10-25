import { useNavigation } from '@react-navigation/native';
import { aiModelKindSchema } from '@squidbox/shared';

import useAiCatalog from './useAiCatalog';
import useLeaveWhenUnavailable from './useLeaveWhenUnavailable';
import useVeniceBalance from './useVeniceBalance';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import joinYourModels from '@/features/model-compare/joinYourModels';
import modelKindText from '@/features/model-compare/modelKindText';
import { readChosenModels } from '@/sync/aiStateRepository';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

// Settings → Assistant: for now only the Testing section, the models the coming assistant uses,
// and what is left on the Venice account.
export default function AssistantScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const chosen = useLiveQuery((db) => readChosenModels(db), [schema.aiKinds, schema.aiModels]);
  const { models: catalog } = useAiCatalog();
  const balance = useVeniceBalance();

  // The chosen model's name, or a muted "No longer available" once Venice dropped it (its list
  // says which; a catalog still loading or failed to load leaves the plain name). The name and the
  // label together would wrap the row's label.
  function chosenText(kind) {
    if (chosen === undefined) return { value: null, isGone: false };
    const model = chosen[kind];
    if (!model) return { value: 'Not chosen', isGone: false };
    const isGone = !!catalog && joinYourModels([model], catalog, kind)[0].model === null;
    return { value: isGone ? 'No longer available' : model.name, isGone };
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Assistant" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <ScreenSectionHeader title="Testing" />
        <Section>
          {aiModelKindSchema.options.map((kind) => {
            const { value, isGone } = chosenText(kind);
            return (
              <Row
                key={kind}
                label={modelKindText[kind].title}
                value={value}
                isValueMuted={isGone}
                onPress={() => navigation.navigate('ModelListScreen', { kind })}
                chevron
              />
            );
          })}
          <Row label="Venice balance" value={balance.value} isValueMuted={balance.isError} />
        </Section>
        <SectionFooter>Only in test builds.</SectionFooter>
      </DetailScrollView>
    </Page>
  );
}
