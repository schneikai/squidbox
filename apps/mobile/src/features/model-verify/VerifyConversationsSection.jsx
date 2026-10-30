import { useNavigation } from '@react-navigation/native';

import VerifyStatusIcon from './VerifyStatusIcon';
import sectionStatuses from './sectionStatuses';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';

const FOOTERS = {
  running: "You can leave this screen. It keeps running and the model's page shows the result when it's done.",
  done: 'Tap a conversation to read it.',
  stopped: "It didn't finish: the turns before it stopped are kept. Verify again to run it all.",
};

/**
 * A writing Verify's conversations, one row per section of its `plan`: how it went (or that it runs,
 * waits or wasn't reached), and a tap opens it once it has turns.
 */
export default function VerifyConversationsSection({ kind, modelId, name, run, plan }) {
  const navigation = useNavigation();
  const statuses = sectionStatuses(plan, run);

  return (
    <>
      <ScreenSectionHeader title="Conversations" />
      <Section>
        {plan.sections.map((planSection, index) => {
          const { icon, text, hasTurns } = statuses[index];
          const open = () =>
            navigation.navigate('VerifyConversationScreen', { kind, modelId, name, sectionId: planSection.id });
          return (
            <Row
              key={planSection.id}
              leading={<VerifyStatusIcon status={icon} />}
              label={planSection.title}
              description={text}
              hasChevron={hasTurns}
              onPress={hasTurns ? open : undefined}
            />
          );
        })}
      </Section>
      <SectionFooter>{FOOTERS[run.status]}</SectionFooter>
    </>
  );
}
