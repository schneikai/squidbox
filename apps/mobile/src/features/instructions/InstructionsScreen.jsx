import { useNavigation } from '@react-navigation/native';
import { StyleSheet } from 'react-native';

import instructionText from './instructionText';
import useInstructionKinds from './useInstructionKinds';

import Badge from '@/components/Badge';
import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useInstructions from '@/hooks/useInstructions';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import { layout } from '@/styles/designTokens';

// Settings → Assistant → Instructions: what the assistant is told before each kind of request, one
// row per kind with the first line of its text, a Changed badge while it isn't the app's. The judge
// of Verify shows only to an ai_admin account, the only one that runs it.
export default function InstructionsScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const { stored, texts } = useInstructions();
  const kinds = useInstructionKinds();

  function row(kind) {
    return (
      <Row
        key={kind}
        label={instructionText[kind].title}
        description={texts && texts[kind].split('\n')[0]}
        onPress={() => navigation.navigate('InstructionScreen', { kind })}
        chevron
      >
        {stored?.[kind] != null && <Badge label="Changed" tone="accent" style={styles.changed} />}
      </Row>
    );
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Instructions" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <IntroText style={styles.intro}>
          What the assistant is told before each request. Change it to fit how you work; Reset brings the app's text
          back.
        </IntroText>
        <Section>{kinds.map(row)}</Section>
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 4,
    marginBottom: layout.introGap,
  },
  changed: {
    alignSelf: 'center',
  },
});
