import { type AiModelKind, aiModelKindSchema, COMPARE_MIN_MODELS, VISION_COMPARE_MAX_PHOTOS } from '@squidbox/shared';
import { router, useNavigation } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import ModelPickRow from './ModelPickRow';
import PhotoSetRow from './PhotoSetRow';
import modelKindText from './modelKindText';

import Button from '@/components/Button';
import CatalogStatus from '@/components/CatalogStatus';
import IntroText from '@/components/IntroText';
import ModalHeader from '@/components/ModalHeader';
import ModalSheet from '@/components/ModalSheet';
import FloatingPrimaryAction from '@/components/floating-bars/FloatingPrimaryAction';
import useFloatingPrimaryActionPadding from '@/components/floating-bars/useFloatingPrimaryActionPadding';
import { Section } from '@/components/settings-list/SettingsList';
import { SCREEN_PADDING } from '@/constants';
import useAssetPicker from '@/features/asset-picker/useAssetPicker';
import useAvailableParam from '@/hooks/useAvailableParam';
import useYourModels from '@/hooks/useYourModels';
import { layout, space } from '@/styles/designTokens';
import { readLiveAssets, readVisionPhotos, setVisionPhotos } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';
import pluralizeText from '@/utils/pluralizeText';
import toggleItem from '@/utils/toggleItem';

// The compare's first step (route param `kind`): tick 2 or more of your available models, shown as
// in your list, and for vision pick the photos (the last compare's to start with). Start saves the
// photos for CompareRoundScreen, which reads them back.
export default function ComparePickScreen() {
  const kind = useAvailableParam('kind', aiModelKindSchema, 'ai_admin');
  if (kind === null) return null;
  return <ComparePick kind={kind} />;
}

type ComparePickProps = { kind: AiModelKind };

function ComparePick({ kind }: ComparePickProps) {
  const navigation = useNavigation();
  const isVision = kind === 'vision';
  const paddingBottom = useFloatingPrimaryActionPadding();
  const { openAssetPicker } = useAssetPicker();
  const { rows, defaults, yourDefaults, usedId, error, retry } = useYourModels(kind);
  // Your changes only: null keeps the default, the current choice ticked.
  const [tickedIds, setTickedIds] = useState<string[] | null>(null);
  // Every photo picked here, of which the first VISION_COMPARE_MAX_PHOTOS count; null keeps the
  // last compare's.
  const [pickedIds, setPickedIds] = useState<string[] | null>(null);
  const photos = useLiveQuery(
    async (db) => {
      if (!isVision) return [];
      return pickedIds ? readLiveAssets(db, pickedIds.slice(0, VISION_COMPARE_MAX_PHOTOS)) : readVisionPhotos(db);
    },
    [schema.assets, schema.aiVisionPhotos],
    [pickedIds, isVision],
  );

  const models = rows?.filter((row) => row.model !== null) ?? [];
  const ticked = tickedIds ?? (usedId !== null && models.some(({ id }) => id === usedId) ? [usedId] : []);
  const modelCount = ticked.length;
  const hasPhotos = !isVision || (photos?.length ?? 0) > 0;
  const canStart = modelCount >= COMPARE_MIN_MODELS && hasPhotos;
  const photosDetail =
    pickedIds === null
      ? 'Same as last time'
      : pickedIds.length > VISION_COMPARE_MAX_PHOTOS
        ? `The first ${VISION_COMPARE_MAX_PHOTOS} of ${pickedIds.length}`
        : null;

  async function handlePickPhotos() {
    const assets = await openAssetPicker();
    if (assets?.length) setPickedIds(assets.map(({ id }) => id));
  }

  async function handleStart() {
    if (pickedIds !== null) {
      try {
        // Read again: right after a pick, `photos` can still be the last set.
        const picked = await readLiveAssets(getDb(), pickedIds.slice(0, VISION_COMPARE_MAX_PHOTOS));
        await setVisionPhotos(
          getDb(),
          picked.map(({ id }) => id),
        );
      } catch (error) {
        console.error('Saving the photos failed', error);
        Alert.alert("Couldn't save the photos", error instanceof Error ? error.message : String(error));
        return;
      }
    }
    // In your list's order, so a round's letters are the only shuffle.
    const modelIds = models.filter(({ id }) => ticked.includes(id)).map(({ id }) => id);
    router.navigate({ pathname: '/compare/[kind]/round', params: { kind, modelIds: modelIds.join(',') } });
  }

  return (
    <ModalSheet>
      <ModalHeader
        leading={<Button icon="close" accessibilityLabel="Close" onPress={() => navigation.goBack()} />}
        title="Compare"
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom }]}>
        <IntroText isScreenIntro>{modelKindText[kind].pickIntro}</IntroText>
        {rows ? (
          <Section>
            {models.map(({ id, name, model, score }) => (
              <ModelPickRow
                key={id}
                id={id}
                name={name}
                model={model}
                kind={kind}
                score={score}
                yourDefaults={yourDefaults}
                defaults={defaults}
                isTicked={ticked.includes(id)}
                onToggle={() => setTickedIds(toggleItem(ticked, id))}
              />
            ))}
          </Section>
        ) : (
          <CatalogStatus error={error} retry={retry} />
        )}
        {isVision && photos && <PhotoSetRow assets={photos} detail={photosDetail} onPick={handlePickPhotos} />}
      </ScrollView>
      <FloatingPrimaryAction>
        <Button
          variant="primary"
          label={`Start with ${pluralizeText('%{count} model', '%{count} models', modelCount)}`}
          onPress={handleStart}
          disabled={!canStart}
        />
      </FloatingPrimaryAction>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: layout.sheetContentTop,
    paddingHorizontal: SCREEN_PADDING,
    gap: space.md,
  },
});
