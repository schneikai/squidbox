import { useNavigation } from '@react-navigation/native';
import { APP_PROMPT_KINDS, INSTRUCTION_KINDS } from '@squidbox/shared';
import { StyleSheet } from 'react-native';

import instructionText from './instructionText';

import Badge from '@/components/Badge';
import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import useHasFeature from '@/hooks/useHasFeature';
import useInstructions from '@/hooks/useInstructions';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';

// Settings → Assistant → Instructions: what the assistant is told before each kind of request, one
// row per kind with the first line of its text, a Changed badge while it isn't the app's. App prompts: the
// app's own texts around them, the same way, for this account only, and only for an ai_admin account.
export default function InstructionsScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const canEditAppPrompts = useHasFeature('ai_admin');
  const { stored, texts } = useInstructions();

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
        <Section>{INSTRUCTION_KINDS.map(row)}</Section>
        {canEditAppPrompts && (
          <>
            <ScreenSectionHeader title="App prompts" />
            <Section>{APP_PROMPT_KINDS.map(row)}</Section>
            <SectionFooter>
              Hidden prompts the app adds around yours. Changes apply to your account only; changing them for everyone
              takes an app update.
            </SectionFooter>
          </>
        )}
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 4,
  },
  changed: {
    alignSelf: 'center',
  },
});
