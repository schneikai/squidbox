import { useNavigation } from '@react-navigation/native';
import { APP_PROMPT_KINDS, INSTRUCTION_KINDS, resolveInstructions } from '@squidbox/shared';
import { StyleSheet } from 'react-native';

import canEditAppPrompts from './canEditAppPrompts';
import instructionText from './instructionText';

import Badge from '@/components/Badge';
import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useLibrary from '@/library/useLibrary';
import { schema } from '@/sync/db/client';
import { readInstructions } from '@/sync/instructionsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

// Settings → Assistant → Instructions: what the assistant is told before each kind of request, one
// row per kind with the first line of its text, a Changed badge while it isn't the app's. App prompts: the
// app's own texts around them, the same way, for this account only (canEditAppPrompts).
export default function InstructionsScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const stored = useLiveQuery((db) => readInstructions(db, userId), [schema.instructions], [userId]);

  const texts = stored === undefined ? null : resolveInstructions(stored);

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
