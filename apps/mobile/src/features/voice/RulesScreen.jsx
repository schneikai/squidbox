import { useNavigation } from '@react-navigation/native';

import RulesField from './RulesField';
import voiceFields from './voiceFields';

import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import usePersona from '@/hooks/usePersona';

// Settings → Assistant → Rules: what the assistant must always or never do, one row each; a tap opens
// one (RuleScreen), Add a rule adds one. Reachable from anywhere (a root screen).
export default function RulesScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const persona = usePersona();

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title={voiceFields.rules.label} onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <IntroText isScreenIntro>{voiceFields.rules.description}</IntroText>
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
