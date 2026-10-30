import { useNavigation } from '@react-navigation/native';

import PromptButtonGroup from './PromptButtonGroup';
import usePromptButtons from './usePromptButtons';

import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedPromptButtons from '@/hooks/useSeedPromptButtons';
import { getDb } from '@/sync/db/client';
import { movePromptButton } from '@/sync/promptButtonsRepository';
import { requestSync } from '@/sync/worker';

// Settings → Assistant → Prompt buttons: the chat's one-tap prompts, one list. Reachable from
// anywhere (a root screen), so the chat opens it too.
export default function PromptButtonsScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const buttons = usePromptButtons();
  useSeedPromptButtons();
  const haptics = useHaptics();

  function handleOpen(button) {
    navigation.navigate('PromptButtonScreen', { id: button.id });
  }

  function handleAdd() {
    navigation.navigate('PromptButtonScreen', {});
  }

  function handleMove(id, afterId) {
    movePromptButton(getDb(), id, afterId).then(requestSync, (error) => {
      console.error('Moving the prompt button failed', error);
      haptics.error();
    });
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Prompt buttons" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <IntroText isScreenIntro>Add shortcuts for requests you make on every post.</IntroText>
        {buttons && <PromptButtonGroup buttons={buttons} onOpen={handleOpen} onAdd={handleAdd} onMove={handleMove} />}
      </DetailScrollView>
    </Page>
  );
}
