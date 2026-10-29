import { useNavigation } from '@react-navigation/native';
import { INSTRUCTION_KINDS } from '@squidbox/shared';
import { StyleSheet } from 'react-native';

import instructionText from './instructionText';

import Badge from '@/components/Badge';
import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useInstructions from '@/hooks/useInstructions';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';

// Settings → Assistant → Admin → Instructions, for an ai_admin account: what the assistant is told
// before each kind of request, one row per kind with its name and what it is for (instructionText), a Changed badge
// while it isn't the app's.
export default function InstructionsScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const { stored } = useInstructions();

  function row(kind) {
    return (
      <Row
        key={kind}
        label={instructionText[kind].title}
        description={instructionText[kind].description}
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
        <Section>{INSTRUCTION_KINDS.map(row)}</Section>
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  changed: {
    alignSelf: 'center',
  },
});
