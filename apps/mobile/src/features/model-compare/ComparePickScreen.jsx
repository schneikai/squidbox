import { COMPARE_MAX_MODELS, COMPARE_MIN_MODELS } from '@squidbox/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPrimaryAction, { FLOATING_PRIMARY_ACTION_CLEARANCE } from './FloatingPrimaryAction';
import ModelPickRow from './ModelPickRow';
import PhotoSetRow from './PhotoSetRow';
import modelKindText from './modelKindText';

import IntroText from '@/components/IntroText';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import { Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import { readChosenModelId, readVisionPhotos, setVisionPhotos } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';
import pluralizeText from '@/utils/pluralizeText';

// The compare's first step (route params `kind` and `models`, your available models): tick 2 to 4
// models, and for vision pick the photos (the last compare's to start with).
export default function ComparePickScreen({ navigation, route }) {
  const { kind, models } = route.params;
  const isVision = kind === 'vision';
  const { bottom } = useSafeAreaInsets();
  const { openAssetPicker } = useAssetPicker();
  const chosenId = useLiveQuery((db) => readChosenModelId(db, kind), [schema.aiKinds], [kind]);
  // Your changes only: null keeps the default, the current choice ticked.
  const [tickedIds, setTickedIds] = useState(null);
  // The photos picked here; null keeps the last compare's.
  const [pickedIds, setPickedIds] = useState(null);
  const photos = useLiveQuery(
    async (db) =>
      pickedIds ? (await readByIds(db, schema.assets, pickedIds)).filter(isLive) : isVision ? readVisionPhotos(db) : [],
    [schema.assets, schema.aiVisionPhotos],
    [pickedIds, isVision],
  );

  const ticked = tickedIds ?? (models.some(({ id }) => id === chosenId) ? [chosenId] : []);
  const modelCount = ticked.length;
  const hasPhotos = !isVision || (photos?.length ?? 0) > 0;
  const canStart = modelCount >= COMPARE_MIN_MODELS && modelCount <= COMPARE_MAX_MODELS && hasPhotos;

  function handleToggle(id) {
    setTickedIds(ticked.includes(id) ? ticked.filter((tickedId) => tickedId !== id) : [...ticked, id]);
  }

  async function handlePickPhotos() {
    const assets = await openAssetPicker();
    if (assets?.length) setPickedIds(assets.map(({ id }) => id));
  }

  async function handleStart() {
    const photoIds = isVision ? photos.map(({ id }) => id) : undefined;
    if (isVision) await setVisionPhotos(getDb(), photoIds);
    // In your list's order, so a round's letters are the only shuffle.
    const tickedModels = models.filter(({ id }) => ticked.includes(id));
    navigation.navigate('CompareScreen', { kind, models: tickedModels, photoIds });
  }

  return (
    <ModalSheet>
      <ModalHeader leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />} centerSlot="Compare" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottom + FLOATING_PRIMARY_ACTION_CLEARANCE }]}
      >
        <IntroText style={styles.intro}>{modelKindText[kind].pickIntro}</IntroText>
        <Section>
          {models.map(({ id, name }) => (
            <ModelPickRow
              key={id}
              name={name}
              isTicked={ticked.includes(id)}
              isCurrent={id === chosenId}
              onToggle={() => handleToggle(id)}
            />
          ))}
        </Section>
        {isVision && photos && (
          <PhotoSetRow assets={photos} isLastTime={pickedIds === null} onPick={handlePickPhotos} />
        )}
      </ScrollView>
      <FloatingPrimaryAction>
        <PrimaryButton
          label={`Start with ${pluralizeText('%{count} model', '%{count} models', modelCount)}`}
          onPress={handleStart}
          disabled={!canStart}
        />
      </FloatingPrimaryAction>
    </ModalSheet>
  );
}

// A photo still in the library (deleted ones drop out of the set).
function isLive(asset) {
  return asset.deletedAt === null && asset.purgedAt === null;
}

const styles = StyleSheet.create({
  content: {
    paddingTop: MODAL_HEADER_HEIGHT,
    paddingHorizontal: SCREEN_PADDING,
    gap: 12,
  },
  intro: {
    paddingHorizontal: 4,
  },
});
