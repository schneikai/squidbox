import { useNavigation } from '@react-navigation/native';
import { INSTRUCTION_KINDS } from '@squidbox/shared';

import instructionText from './instructionText';

import CatalogStatus from '@/components/CatalogStatus';
import ChangedBadge from '@/components/ChangedBadge';
import DetailScrollView from '@/components/DetailScrollView';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useInstructions from '@/hooks/useInstructions';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';

// Settings → Assistant → Admin → Instructions, for an ai_admin account: what the assistant is told
// before each kind of request, one row per kind with its name and what it is for (instructionText), a Changed badge
// while the user stored their own text.
export default function InstructionsScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const { changedKinds, error, retry } = useInstructions();

  function row(kind) {
    return (
      <Row
        key={kind}
        label={instructionText[kind].title}
        description={instructionText[kind].description}
        onPress={() => navigation.navigate('InstructionScreen', { kind })}
        chevron
      >
        {changedKinds?.includes(kind) && <ChangedBadge />}
      </Row>
    );
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Instructions" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <Section>{INSTRUCTION_KINDS.map(row)}</Section>
        {error && <CatalogStatus title="Couldn't load the instructions" error={error} retry={retry} />}
      </DetailScrollView>
    </Page>
  );
}
