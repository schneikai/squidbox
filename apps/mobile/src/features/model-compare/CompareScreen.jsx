import { resolveInstructions } from '@squidbox/shared';

import CompareRound from './CompareRound';

import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import useLibrary from '@/library/useLibrary';
import { readPrompt, readVisionPhotos } from '@/sync/aiStateRepository';
import { readInstructions } from '@/sync/instructionsRepository';

// The writing compare's sample request before the first compare; after it, the last one used. The
// server adds the user's writing instructions and asks for the post count itself.
const WRITING_PROMPT =
  'Write posts about a sunrise hike for my followers. Calm, a little dry. Under 200 characters each.';

// The compare's second step (route params `kind` and the ticked `models`), from the remembered
// prompt (vision's starts from the user's Photo tags instructions) and for vision the photo set the
// pick step saved, read once.
export default function CompareScreen({ navigation, route }) {
  const { kind, models } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const seed = useSeedOrClose((db) => readSeed(db, kind, userId), kind);

  if (!isAvailable || !seed) return null;

  return (
    <CompareRound
      navigation={navigation}
      kind={kind}
      models={models}
      savedPrompt={seed.prompt}
      defaultPrompt={seed.defaultPrompt}
      photos={seed.photos}
    />
  );
}

async function readSeed(db, kind, userId) {
  if (kind !== 'vision') return { prompt: await readPrompt(db, kind), defaultPrompt: WRITING_PROMPT, photos: [] };
  const [prompt, photos, instructions] = await Promise.all([
    readPrompt(db, kind),
    readVisionPhotos(db),
    readInstructions(db, userId),
  ]);
  return { prompt, defaultPrompt: resolveInstructions(instructions).visionTagging, photos };
}
