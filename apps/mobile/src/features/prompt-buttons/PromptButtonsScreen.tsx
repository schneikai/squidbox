import type { NewPromptButton } from '@squidbox/shared';
import { router, useNavigation, usePathname } from 'expo-router';

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

// Settings → Assistant → Prompt buttons: the chat's one-tap prompts, one list. The chat opens it too,
// inside its sheet. A button's editor opens under the list's own path, so in Settings it is a sheet
// and in the chat's sheet it pushes.
export default function PromptButtonsScreen() {
  const navigation = useNavigation();
  const pathname = usePathname();
  const isAvailable = useLeaveWhenUnavailable();
  const buttons = usePromptButtons();
  useSeedPromptButtons();
  const haptics = useHaptics();

  function handleOpen(button: NewPromptButton) {
    router.navigate(`${pathname}/${button.id}`);
  }

  function handleAdd() {
    router.navigate(`${pathname}/new`);
  }

  function handleMove(id: string, afterId: string | null) {
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
