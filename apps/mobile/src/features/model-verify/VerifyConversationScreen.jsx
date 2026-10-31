import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import VerifyPostCard from './VerifyPostCard';
import VerifyVerdict from './VerifyVerdict';
import useVerifyRun from './useVerifyRun';

import Card from '@/components/Card';
import CatalogStatus from '@/components/CatalogStatus';
import ChatBubble from '@/components/ChatBubble';
import DetailScrollView from '@/components/DetailScrollView';
import EmptyState from '@/components/EmptyState';
import IntroText from '@/components/IntroText';
import OptionCard from '@/components/OptionCard';
import Page from '@/components/Page';
import Text from '@/components/Text';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section } from '@/components/settings-list/SettingsList';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';

/**
 * One conversation of a writing Verify (route params `kind`, `modelId`, `name`, `sectionId`; an
 * ai_admin tool), read like the chat: what the model was told (collapsed), the post it started
 * with, then each turn: the editor's change, the creator's message, the reply with its posts, and
 * whether it passed. A conversation still running grows as its turns come in.
 */
export default function VerifyConversationScreen({ navigation, route }) {
  const { kind, modelId, sectionId } = route.params;
  const isAvailable = useLeaveWhenUnavailable('ai_admin');
  const { run, plan, error, retry } = useVerifyRun(kind, modelId);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);

  const sections = run?.result?.sections ?? [];
  const section = sections.find((each) => each.id === sectionId);
  const title = plan?.sections.find((each) => each.id === sectionId)?.title ?? '';
  const systemMessage = section?.systemMessage ?? sections[0]?.systemMessage ?? null;

  function renderBody() {
    if (run === undefined) return <CatalogStatus title="Couldn't load Verify" error={error} retry={retry} />;
    if (!section) return <EmptyState icon="message-circle" title="Not reached" />;
    return (
      <>
        {systemMessage && (
          <>
            <Section>
              <Row
                label="System prompt"
                value={isBriefingOpen ? 'Hide' : 'Show'}
                onPress={() => setIsBriefingOpen((isOpen) => !isOpen)}
              />
            </Section>
            {isBriefingOpen && (
              <Card style={styles.briefing}>
                <IntroText selectable>{systemMessage}</IntroText>
              </Card>
            )}
          </>
        )}
        {section.post && <VerifyPostCard post={section.post} />}
        {section.turns.map((turn, index) => (
          <VerifyTurn key={index} turn={turn} />
        ))}
      </>
    );
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title={title} onBack={() => navigation.goBack()} />
      <DetailScrollView contentContainerStyle={styles.content}>{renderBody()}</DetailScrollView>
    </Page>
  );
}

// One turn, memoized: a poll that brings a new turn renders only that one (useVerifyRun keeps the
// earlier turns as they were).
const VerifyTurn = memo(function VerifyTurn({ turn }) {
  return (
    <View style={styles.turn}>
      {turn.note && <IntroText style={styles.note}>{turn.note}</IntroText>}
      <ChatBubble side="user" text={turn.prompt} />
      {turn.error ? (
        <Text variant="error">{turn.error}</Text>
      ) : (
        <>
          {!!turn.reply && <ChatBubble side="assistant" text={turn.reply} />}
          {turn.items.map((item, index) => (
            <OptionCard key={index} text={item} />
          ))}
          {turn.unreadable && <IntroText>Not the JSON: kept as text</IntroText>}
        </>
      )}
      <VerifyVerdict turn={turn} />
    </View>
  );
});

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  briefing: {
    padding: 14,
  },
  turn: {
    gap: 10,
  },
  note: {
    textAlign: 'center',
  },
});
