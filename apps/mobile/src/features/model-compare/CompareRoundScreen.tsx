import type { AiModelKind } from '@squidbox/shared';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import CompareRound from './CompareRound';

import Button from '@/components/Button';
import CatalogStatus from '@/components/CatalogStatus';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import useInstructions from '@/hooks/useInstructions';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useRequiredSheetRoute from '@/hooks/useRequiredSheetRoute';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import listParam from '@/lib/listParam';
import { layout } from '@/styles/designTokens';
import { readModelList, readPrompt, readVisionPhotos } from '@/sync/aiStateRepository';
import type { SyncDb } from '@/sync/db/types';

// The writing compare's sample request before the first compare; after it, the last one used. The
// server sends it alone, without system instructions, so it says how many posts to write.
const WRITING_PROMPT = 'Write 3 posts about a quiet morning hike on the coast. Be creative.';

// The compare's second step (route params `kind` and the ticked `modelIds`, comma-separated), from
// the remembered prompt (vision's starts from the user's Photo tags instructions, which come with the
// catalog: a spinner or Try again until they're in) and for vision the photo set the pick step saved,
// read once with the ticked models' names.
export default function CompareRoundScreen() {
  const { kind, modelIds } = useLocalSearchParams<{ kind: AiModelKind; modelIds: string }>();
  const sheet = useRequiredSheetRoute();
  const isAvailable = useLeaveWhenUnavailable('ai_admin');
  const { texts, error, retry } = useInstructions();
  const seed = useSeedOrClose((db) => readSeed(db, kind, listParam(modelIds)), `${kind}:${modelIds}`);

  const defaultPrompt = kind === 'vision' ? texts?.visionTagging : WRITING_PROMPT;

  if (!isAvailable || !seed) return null;
  if (!defaultPrompt) {
    return (
      <ModalSheet>
        <ModalHeader
          leading={<Button icon="close" accessibilityLabel="Close" onPress={sheet.close} />}
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
      kind={kind}
      models={seed.models}
      savedPrompt={seed.prompt}
      defaultPrompt={defaultPrompt}
      photos={seed.photos}
    />
  );
}

// The ticked models in the order of your list, which is the order they were ticked in.
async function readSeed(db: SyncDb, kind: AiModelKind, modelIds: string[]) {
  const [prompt, photos, list] = await Promise.all([
    readPrompt(db, kind),
    kind === 'vision' ? readVisionPhotos(db) : [],
    readModelList(db, kind),
  ]);
  const models = (list ?? []).filter(({ id }) => modelIds.includes(id)).map(({ id, name }) => ({ id, name }));
  return { prompt, photos, models };
}

const styles = StyleSheet.create({
  status: {
    paddingTop: layout.sheetContentTop,
  },
});
