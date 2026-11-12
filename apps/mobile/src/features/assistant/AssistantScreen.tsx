import { aiModelKindSchema, IDEAS_KINDS, type IdeasKind } from '@squidbox/shared';
import { router, useNavigation } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import personaSummary from './personaSummary';

import ChangedBadge from '@/components/ChangedBadge';
import DetailScrollView from '@/components/DetailScrollView';
import GradientFill from '@/components/GradientFill';
import Icon, { type IconName } from '@/components/Icon';
import Page from '@/components/Page';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import modelKindText from '@/features/model-compare/modelKindText';
import ideasText from '@/features/post-ideas/ideasText';
import useIdeaSettings from '@/features/post-ideas/useIdeaSettings';
import useHasFeature from '@/hooks/useHasFeature';
import useInstructions from '@/hooks/useInstructions';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import usePersona from '@/hooks/usePersona';
import useSeedPromptButtons from '@/hooks/useSeedPromptButtons';
import useVeniceBalance from '@/hooks/useVeniceBalance';
import useYourDefaults from '@/hooks/useYourDefaults';
import { colors, radii, sizes } from '@/styles/designTokens';
import { schema } from '@/sync/db/client';
import { countPromptButtons } from '@/sync/promptButtonsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

// Each kind of ideas' row icon.
const IDEAS_ICONS: Record<IdeasKind, IconName> = { post: 'image', repost: 'repeat' };

// Settings → Assistant: how the assistant writes as you, the ideas it writes without being asked
// (Post ideas, Repost ideas), its prompt buttons, its Rules, and for an ai_admin account the Admin
// section (the model lists, what it is told before each request: Instructions, what is left on the
// Venice account).
export default function AssistantScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const persona = usePersona();
  const promptButtonCount = useLiveQuery((db) => countPromptButtons(db), [schema.promptButtons]);
  useSeedPromptButtons();
  const isAiAdmin = useHasFeature('ai_admin');
  const ideaSettings = useIdeaSettings();

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Assistant" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <Section>
          <Row
            leading={<AssistantMark />}
            label="Writing as you"
            description={persona === undefined ? null : personaSummary(persona)}
            onPress={() => router.navigate('/settings/assistant/voice')}
            hasChevron
          />
        </Section>
        <Section isHeaderless>
          {IDEAS_KINDS.map((kind) => (
            <Row
              key={kind}
              leading={<Icon name={IDEAS_ICONS[kind]} color={colors.text.secondary} />}
              label={ideasText[kind].name}
              value={ideaSettings === undefined ? null : ideaSettings[kind].isOn ? 'On' : 'Off'}
              onPress={() => router.navigate(`/settings/assistant/ideas/${kind}`)}
              hasChevron
            />
          ))}
          <Row
            leading={<Icon name="prompt-buttons" color={colors.text.secondary} />}
            label="Prompt buttons"
            value={promptButtonCount === undefined ? null : String(promptButtonCount)}
            onPress={() => router.navigate('/settings/assistant/prompt-buttons')}
            hasChevron
          />
          <Row
            leading={<Icon name="list-checks" color={colors.text.secondary} />}
            label="Rules"
            value={persona === undefined ? null : String(persona?.rules.length ?? 0)}
            onPress={() => router.navigate('/settings/assistant/rules')}
            hasChevron
          />
        </Section>
        {isAiAdmin && (
          <AdminSection>
            <InstructionsRow />
          </AdminSection>
        )}
      </DetailScrollView>
    </Page>
  );
}

type AdminSectionProps = { children: ReactNode };

// Admin, for an ai_admin account only: the model lists of each kind (Writing, Vision), Changed
// while this account's picks differ from the published defaults, then `children` (Instructions),
// and the Venice balance.
function AdminSection({ children }: AdminSectionProps) {
  const { changedKinds } = useYourDefaults();

  return (
    <>
      <ScreenSectionHeader title="Admin" />
      <Section>
        {aiModelKindSchema.options.map((kind) => (
          <Row
            key={kind}
            label={modelKindText[kind].title}
            onPress={() => router.navigate(`/settings/assistant/models/${kind}`)}
            hasChevron
          >
            {changedKinds?.includes(kind) && <ChangedBadge />}
          </Row>
        ))}
        {children}
      </Section>
      <VeniceBalanceFooter />
    </>
  );
}

// Instructions, Changed while the user's own text of any kind differs from the app's.
function InstructionsRow() {
  const { changedKinds } = useInstructions();

  return (
    <Row label="Instructions" onPress={() => router.navigate('/settings/assistant/instructions')} hasChevron>
      {!!changedKinds?.length && <ChangedBadge />}
    </Row>
  );
}

// What is left on the Venice account, read each time the screen comes into focus.
function VeniceBalanceFooter() {
  const balance = useVeniceBalance();
  return <SectionFooter>Venice balance: {balance.value ?? '…'}</SectionFooter>;
}

// The assistant's mark: its sparkle on an accent disc.
function AssistantMark() {
  return (
    <GradientFill style={styles.mark}>
      <Icon name="sparkle" size={sizes.icon} color={colors.text.inverse} />
    </GradientFill>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
