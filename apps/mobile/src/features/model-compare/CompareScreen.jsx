import { StyleSheet, View } from 'react-native';

import CompareRound from './CompareRound';

import CatalogStatus from '@/components/CatalogStatus';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import useInstructions from '@/hooks/useInstructions';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { readPrompt, readVisionPhotos } from '@/sync/aiStateRepository';

// The writing compare's sample request before the first compare; after it, the last one used. The
// server sends it after the user's Writing briefing, filled without a post.
const WRITING_PROMPT =
  'Write posts about a sunrise hike for my followers. Calm, a little dry. Under 200 characters each.';

// The compare's second step (route params `kind` and the ticked `models`), from the remembered
// prompt (vision's starts from the user's Photo tags instructions, theirs or the app's default, so
// it waits for the catalog) and for vision the photo set the pick step saved, read once.
export default function CompareScreen({ navigation, route }) {
  const { kind, models } = route.params;
  const isAvailable = useLeaveWhenUnavailable('ai_admin');
  const { texts, error, retry } = useInstructions();
  const seed = useSeedOrClose((db) => readSeed(db, kind), kind);

  const defaultPrompt = kind === 'vision' ? texts?.visionTagging : WRITING_PROMPT;

  if (!isAvailable || !seed) return null;
  if (!defaultPrompt) {
    return (
      <ModalSheet>
        <ModalHeader
          leftSlot={<ModalCloseButton onPress={() => navigation.getParent().goBack()} />}
          centerSlot="Compare"
        />
        <View style={styles.status}>
          <CatalogStatus title="Couldn't load the instructions" error={error} retry={retry} />
        </View>
      </ModalSheet>
    );
  }

  return (
    <CompareRound
      navigation={navigation}
      kind={kind}
      models={models}
      savedPrompt={seed.prompt}
      defaultPrompt={defaultPrompt}
      photos={seed.photos}
    />
  );
}

async function readSeed(db, kind) {
  if (kind !== 'vision') return { prompt: await readPrompt(db, kind), photos: [] };
  const [prompt, photos] = await Promise.all([readPrompt(db, kind), readVisionPhotos(db)]);
  return { prompt, photos };
}

const styles = StyleSheet.create({
  status: {
    paddingTop: MODAL_HEADER_HEIGHT,
  },
});
