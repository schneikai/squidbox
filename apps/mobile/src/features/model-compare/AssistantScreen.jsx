import { useNavigation } from '@react-navigation/native';

import modelKindText from './modelKindText';
import useAiCatalog from './useAiCatalog';
import useLeaveWhenUnavailable from './useLeaveWhenUnavailable';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import { readChosenModels } from '@/sync/aiStateRepository';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const KINDS = ['writing', 'vision'];

// Settings → Assistant: for now only the Testing section, the models the coming assistant uses.
export default function AssistantScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const chosen = useLiveQuery((db) => readChosenModels(db), [schema.aiKinds, schema.aiModels]);
  const { models: catalog } = useAiCatalog();

  // The chosen model's name, or a muted "No longer available" once Venice dropped it (its list
  // says which; a catalog still loading or failed to load leaves the plain name). The name and the
  // label together would wrap the row's label.
  function chosenText(kind) {
    const model = chosen?.[kind];
    if (chosen === undefined) return null;
    if (!model) return { value: 'Not chosen', isGone: false };
    const isGone = !!catalog && !catalog.some(({ id }) => id === model.id);
    return { value: isGone ? 'No longer available' : model.name, isGone };
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Assistant" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <ScreenSectionHeader title="Testing" />
        <Section>
          {KINDS.map((kind) => (
            <Row
              key={kind}
              label={modelKindText[kind].title}
              value={chosenText(kind)?.value}
              isValueMuted={chosenText(kind)?.isGone}
              onPress={() => navigation.navigate('ModelListScreen', { kind })}
              chevron
            />
          ))}
        </Section>
        <SectionFooter>Only in test builds.</SectionFooter>
      </DetailScrollView>
    </Page>
  );
}
