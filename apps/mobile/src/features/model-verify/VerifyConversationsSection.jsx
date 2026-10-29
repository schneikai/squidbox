import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator } from 'react-native';

import sectionStatus from './sectionStatus';

import Icon from '@/components/Icon';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import { colors, sizes } from '@/styles/designTokens';

// Each sectionStatus icon as the row shows it.
const ICONS = {
  passed: { name: 'check-circle', color: colors.status.success },
  missed: { name: 'close-circle', color: colors.status.danger },
  stopped: { name: 'alert', color: colors.status.danger },
  waiting: { name: 'clock', color: colors.text.tertiary },
};

const FOOTERS = {
  running: "You can leave this screen. It keeps running and the model's page shows the result when it's done.",
  done: 'Tap a conversation to read it.',
  stopped: 'Nothing is saved as a result. Verify again when Venice is back.',
};

/**
 * A writing Verify's conversations, one row per section of its `plan`: how it went (or that it runs,
 * waits or wasn't reached), and a tap opens it once it has turns.
 */
export default function VerifyConversationsSection({ kind, modelId, name, run, plan }) {
  const navigation = useNavigation();
  const results = new Map(run.result?.sections.map((section) => [section.id, section]));

  return (
    <>
      <ScreenSectionHeader title="Conversations" />
      <Section>
        {plan.sections.map((planSection, index) => {
          const { icon, text } = sectionStatus(plan, index, run);
          const hasTurns = (results.get(planSection.id)?.turns.length ?? 0) > 0;
          const open = () =>
            navigation.navigate('VerifyConversationScreen', { kind, modelId, name, sectionId: planSection.id });
          return (
            <Row
              key={planSection.id}
              leading={
                icon === 'running' ? (
                  <ActivityIndicator color={colors.text.secondary} />
                ) : (
                  <Icon name={ICONS[icon].name} size={sizes.icon} color={ICONS[icon].color} />
                )
              }
              label={planSection.title}
              description={text}
              chevron={hasTurns}
              onPress={hasTurns ? open : undefined}
            />
          );
        })}
      </Section>
      <SectionFooter>{FOOTERS[run.status]}</SectionFooter>
    </>
  );
}
