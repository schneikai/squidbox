import { StyleSheet, View } from 'react-native';

import CompareRound from './CompareRound';

import Button from '@/components/Button';
import CatalogStatus from '@/components/CatalogStatus';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import useInstructions from '@/hooks/useInstructions';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { readPrompt, readVisionPhotos } from '@/sync/aiStateRepository';

// The writing compare's sample request before the first compare; after it, the last one used. The
// server sends it alone, without system instructions, so it says how many posts to write.
const WRITING_PROMPT = 'Write 3 posts about a quiet morning hike on the coast. Be creative.';

// The compare's second step (route params `kind` and the ticked `models`), from the remembered
// prompt (vision's starts from the user's Photo tags instructions, which come with the catalog: a
// spinner or Try again until they're in) and for vision the photo set the pick step saved, read once.
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
          leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.getParent().goBack()} />}
          title="Compare"
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
  const [prompt, photos] = await Promise.all([readPrompt(db, kind), kind === 'vision' ? readVisionPhotos(db) : []]);
  return { prompt, photos };
}

const styles = StyleSheet.create({
  status: {
    paddingTop: MODAL_HEADER_HEIGHT,
  },
});
