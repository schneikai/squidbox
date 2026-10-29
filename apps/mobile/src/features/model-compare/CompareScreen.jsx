import CompareRound from './CompareRound';

import useInstructions from '@/hooks/useInstructions';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { readPrompt, readVisionPhotos } from '@/sync/aiStateRepository';

// The writing compare's sample request before the first compare; after it, the last one used. The
// server sends it after the user's Writing briefing, filled without a post.
const WRITING_PROMPT =
  'Write posts about a sunrise hike for my followers. Calm, a little dry. Under 200 characters each.';

// The compare's second step (route params `kind` and the ticked `models`), from the remembered
// prompt (vision's starts from the user's Photo tags instructions, which come with the catalog the
// pick step loaded) and for vision the photo set the pick step saved, read once.
export default function CompareScreen({ navigation, route }) {
  const { kind, models } = route.params;
  const isAvailable = useLeaveWhenUnavailable('ai_admin');
  const { texts } = useInstructions();
  const seed = useSeedOrClose((db) => readSeed(db, kind), kind);

  const defaultPrompt = kind === 'vision' ? texts?.visionTagging : WRITING_PROMPT;

  if (!isAvailable || !seed || !defaultPrompt) return null;

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
