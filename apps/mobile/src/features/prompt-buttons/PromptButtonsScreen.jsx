import { useNavigation } from '@react-navigation/native';
import { StyleSheet } from 'react-native';

import PromptButtonGroup from './PromptButtonGroup';
import { PLACEMENTS } from './placementText';
import usePromptButtons from './usePromptButtons';

import DetailScrollView from '@/components/DetailScrollView';
import IntroText from '@/components/IntroText';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useHaptics from '@/hooks/useHaptics';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import { getDb } from '@/sync/db/client';
import { movePromptButton } from '@/sync/promptButtonsRepository';

// Settings → Assistant → Prompt buttons: the chat's one-tap prompts, in three groups. Reachable from
// anywhere (a root screen), so the chat opens it too.
export default function PromptButtonsScreen() {
  const navigation = useNavigation();
  const isAvailable = useLeaveWhenUnavailable();
  const groups = usePromptButtons();
  const haptics = useHaptics();

  function handleOpen(button) {
    navigation.navigate('PromptButtonModal', { id: button.id });
  }

  function handleAdd(placement) {
    navigation.navigate('PromptButtonModal', { placement });
  }

  function handleMove(id, afterId) {
    movePromptButton(getDb(), id, afterId).catch((error) => {
      console.error('Moving the prompt button failed', error);
      haptics.error();
    });
  }

  if (!isAvailable) return null;

  return (
    <Page>
      <FloatingDetailHeader title="Prompt buttons" onBack={() => navigation.goBack()} />
      <DetailScrollView>
        <IntroText style={styles.intro}>Tap a button to edit it, drag to move it.</IntroText>
        {groups &&
          PLACEMENTS.map((placement) => (
            <PromptButtonGroup
              key={placement}
              placement={placement}
              buttons={groups[placement]}
              onOpen={handleOpen}
              onAdd={handleAdd}
              onMove={handleMove}
            />
          ))}
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 4,
  },
});
