import { useNavigation } from '@react-navigation/native';
import { StyleSheet } from 'react-native';

import RulesField from './RulesField';
import voiceFields from './voiceFields';

import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useLibrary from '@/library/useLibrary';
import { layout } from '@/styles/designTokens';
import { schema } from '@/sync/db/client';
import { readPersona } from '@/sync/personaRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

// Settings → Assistant → Rules: what the assistant must always or never do, one row each; a tap opens
// one (RuleScreen), Add a rule adds one. Reachable from anywhere (a root screen).
export default function RulesScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const persona = useLiveQuery((db) => readPersona(db, userId), [schema.personas], [userId]);

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title={voiceFields.rules.label} onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <IntroText style={styles.intro}>{voiceFields.rules.description}</IntroText>
        {persona !== undefined && (
          <RulesField
            rules={persona?.rules ?? []}
            onOpen={(index) => navigation.navigate('RuleScreen', { index })}
            onAdd={() => navigation.navigate('RuleScreen')}
          />
        )}
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 4,
    marginBottom: layout.introGap,
  },
});
