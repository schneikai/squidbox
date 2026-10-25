import { COMPARE_MAX_MODELS, COMPARE_MIN_MODELS } from '@squidbox/shared';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModelPickRow from './ModelPickRow';
import PhotoSetRow from './PhotoSetRow';
import PinnedAction, { PINNED_ACTION_CLEARANCE } from './PinnedAction';
import { readChosenModel, readVisionPhotoIds, setVisionPhotoIds } from './aiState';
import modelKindText from './modelKindText';

import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import PrimaryButton from '@/components/PrimaryButton';
import { Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import { colors, lineHeights, typography } from '@/styles/designTokens';
import { getDb, schema } from '@/sync/db/client';
import { readByIds } from '@/sync/readByIds';
import { useLiveQuery } from '@/sync/useLiveQuery';

// The compare's first step (route params `kind` and `models`, your available models): tick 2 to 4
// models, and for vision pick the photos (the last compare's to start with).
export default function ComparePickScreen({ navigation, route }) {
  const { kind, models } = route.params;
  const isVision = kind === 'vision';
  const { bottom } = useSafeAreaInsets();
  const { openAssetPicker } = useAssetPicker();
  const chosen = useLiveQuery((db) => readChosenModel(db, kind), [schema.aiState], [kind]);
  const [tickedIds, setTickedIds] = useState(null); // null until the current choice is read
  // The photos' asset ids, null until the last compare's are read; `isLastTime` while they're those.
  const [photos, setPhotos] = useState({ ids: null, isLastTime: false });
  const photoAssets = useLiveQuery(
    async (db) => (await readByIds(db, schema.assets, photos.ids ?? [])).filter(isLive),
    [schema.assets],
    [photos.ids],
  );

  // The current choice starts ticked.
  useEffect(() => {
    if (chosen === undefined || tickedIds !== null) return;
    setTickedIds(models.some(({ id }) => id === chosen?.id) ? [chosen.id] : []);
  }, [chosen]);

  useEffect(() => {
    if (!isVision) return;
    readVisionPhotoIds(getDb()).then((ids) => setPhotos({ ids: ids ?? [], isLastTime: !!ids?.length }));
  }, [isVision]);

  const ticked = tickedIds ?? [];
  const modelCount = ticked.length;
  const hasPhotos = !isVision || (photoAssets?.length ?? 0) > 0;
  const canStart = modelCount >= COMPARE_MIN_MODELS && modelCount <= COMPARE_MAX_MODELS && hasPhotos;

  function handleToggle(id) {
    setTickedIds(ticked.includes(id) ? ticked.filter((tickedId) => tickedId !== id) : [...ticked, id]);
  }

  async function handlePickPhotos() {
    const assets = await openAssetPicker();
    if (assets?.length) setPhotos({ ids: assets.map(({ id }) => id), isLastTime: false });
  }

  async function handleStart() {
    // In your list's order, so a round's letters are the only shuffle.
    const modelIds = models.map(({ id }) => id).filter((id) => ticked.includes(id));
    const photoIds = isVision ? photoAssets.map(({ id }) => id) : undefined;
    if (isVision) await setVisionPhotoIds(getDb(), photoIds);
    navigation.navigate('CompareScreen', { kind, models, modelIds, photoIds });
  }

  return (
    <ModalSheet>
      <ModalHeader leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />} centerSlot="Compare" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottom + PINNED_ACTION_CLEARANCE + SCREEN_PADDING }]}
      >
        <Text style={styles.intro}>{modelKindText[kind].pickIntro}</Text>
        <Section>
          {models.map(({ id, name }) => (
            <ModelPickRow
              key={id}
              name={name}
              isTicked={ticked.includes(id)}
              isCurrent={id === chosen?.id}
              onToggle={() => handleToggle(id)}
            />
          ))}
        </Section>
        {isVision && photoAssets && (
          <PhotoSetRow assets={photoAssets} isLastTime={photos.isLastTime} onPick={handlePickPhotos} />
        )}
      </ScrollView>
      <PinnedAction>
        <PrimaryButton
          label={`Start with ${modelCount} ${modelCount === 1 ? 'model' : 'models'}`}
          onPress={handleStart}
          disabled={!canStart}
        />
      </PinnedAction>
    </ModalSheet>
  );
}

// A photo still in the library (deleted ones drop out of the remembered set).
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
    fontSize: typography.subheadline,
    color: colors.text.secondary,
    lineHeight: lineHeights.subheadline,
    paddingHorizontal: 4,
  },
});
