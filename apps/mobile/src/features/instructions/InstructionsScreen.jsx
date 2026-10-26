import { useNavigation } from '@react-navigation/native';
import { INSTRUCTION_KINDS, resolveInstructions } from '@squidbox/shared';
import { StyleSheet } from 'react-native';

import instructionText from './instructionText';

import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useLibrary from '@/library/useLibrary';
import { schema } from '@/sync/db/client';
import { readInstructions } from '@/sync/instructionsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

// Settings → Assistant → Instructions: what the assistant is told before each kind of request, one
// row per kind with the first line of its text, "Changed" while it isn't the app's.
export default function InstructionsScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const stored = useLiveQuery((db) => readInstructions(db, userId), [schema.instructions], [userId]);

  const texts = stored === undefined ? null : resolveInstructions(stored);

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Instructions" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <IntroText style={styles.intro}>
          What the assistant is told before each request. Change it to fit how you work; Reset brings the app's text
          back.
        </IntroText>
        <Section>
          {INSTRUCTION_KINDS.map((kind) => (
            <Row
              key={kind}
              label={instructionText[kind].title}
              description={texts && texts[kind].split('\n')[0]}
              value={stored?.[kind] != null ? 'Changed' : null}
              onPress={() => navigation.navigate('InstructionModal', { kind })}
              chevron
            />
          ))}
        </Section>
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 4,
  },
});
