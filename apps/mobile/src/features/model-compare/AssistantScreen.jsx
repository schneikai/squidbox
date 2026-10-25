import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text } from 'react-native';

import { readChosenModel } from './aiState';
import modelKindText from './modelKindText';
import useAiCatalog from './useAiCatalog';
import useLeaveWhenUnavailable from './useLeaveWhenUnavailable';

import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import { colors, typography } from '@/styles/designTokens';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const KINDS = ['writing', 'vision'];

// Settings → Assistant: for now only the Testing section, the models the coming assistant uses.
export default function AssistantScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const chosen = useLiveQuery(
    async (db) => ({ writing: await readChosenModel(db, 'writing'), vision: await readChosenModel(db, 'vision') }),
    [schema.aiState],
  );
  const { models: catalog } = useAiCatalog();

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
              onPress={() => navigation.navigate('ModelListScreen', { kind })}
              chevron
            >
              <ChosenModelText model={chosen?.[kind]} catalog={catalog} isLoading={chosen === undefined} />
            </Row>
          ))}
        </Section>
        <SectionFooter>Only in test builds.</SectionFooter>
      </DetailScrollView>
    </Page>
  );
}

// The chosen model's name; greyed with "No longer available" once Venice dropped it (a catalog
// still loading or failed to load leaves the plain name).
function ChosenModelText({ model, catalog, isLoading }) {
  if (isLoading) return null;
  if (!model) return <Text style={styles.value}>Not chosen</Text>;
  const isGone = catalog && !catalog.some(({ id }) => id === model.id);
  return (
    <Text style={[styles.value, isGone && styles.gone]} numberOfLines={1}>
      {isGone ? `${model.name} · No longer available` : model.name}
    </Text>
  );
}

const styles = StyleSheet.create({
  value: {
    flexShrink: 1,
    fontSize: typography.body,
    color: colors.text.secondary,
    textAlign: 'right',
  },
  gone: {
    color: colors.text.tertiary,
  },
});
