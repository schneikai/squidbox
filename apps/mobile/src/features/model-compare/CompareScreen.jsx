import CompareRound from './CompareRound';

import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSeedOrClose from '@/hooks/useSeedOrClose';
import { readPrompt, readVisionPhotos } from '@/sync/aiStateRepository';

// Each kind's prompt before the first compare; after it, the last one used. The server asks for
// the tweet count itself.
const DEFAULT_PROMPTS = {
  writing: "Write spicy tweets for my fans. Tease, don't tell. Under 200 characters each.",
  vision:
    "Tag this photo with 8 short, specific tags of what's in it: subject, clothing, setting, light, pose, " +
    "mood. Lowercase, 1 to 3 words each. Be explicit about adult content when it's there.",
};

// The compare's second step (route params `kind` and the ticked `models`), from the remembered
// prompt and for vision the photo set the pick step saved, read once.
export default function CompareScreen({ navigation, route }) {
  const { kind, models } = route.params;
  const isAvailable = useLeaveWhenUnavailable('ai_admin');
  const seed = useSeedOrClose((db) => readSeed(db, kind), kind);

  if (!isAvailable || !seed) return null;

  return (
    <CompareRound
      navigation={navigation}
      kind={kind}
      models={models}
      savedPrompt={seed.prompt}
      defaultPrompt={DEFAULT_PROMPTS[kind]}
      photos={seed.photos}
    />
  );
}

async function readSeed(db, kind) {
  const [prompt, photos] = await Promise.all([readPrompt(db, kind), kind === 'vision' ? readVisionPhotos(db) : []]);
  return { prompt, photos };
}
