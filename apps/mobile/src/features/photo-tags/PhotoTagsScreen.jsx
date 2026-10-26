import { ASSET_TAG_LIMITS } from '@squidbox/shared';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import useRetag from './useRetag';

import DetailScrollView from '@/components/DetailScrollView';
import Field from '@/components/Field';
import Page from '@/components/Page';
import TagsField from '@/components/TagsField';
import TextButton from '@/components/TextButton';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import useLeaveWhenUnavailable from '@/hooks/useLeaveWhenUnavailable';
import useSaveAsYouType from '@/hooks/useSaveAsYouType';
import { readLiveAssets } from '@/sync/aiStateRepository';
import { setTags } from '@/sync/assetsRepository';
import { getDb, schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const DESCRIPTION = 'What the assistant sees in this photo when it writes about it. Tap a tag to remove it.';

// A photo's tags (`{ assetId }`), to fix: removed and added as chips, saved as you type, and Tag again
// to have the assistant tag it anew. A root screen, one per photo, opened from the tags in the
// photo's details (PhotoTagsSection).
export default function PhotoTagsScreen({ route, navigation }) {
  const { assetId } = route.params;
  const isAvailable = useLeaveWhenUnavailable();
  // null once it doesn't exist or is deleted
  const asset = useLiveQuery(
    async (db) => (await readLiveAssets(db, [assetId]))[0] ?? null,
    [schema.assets],
    [assetId],
  );
  useCloseWhenGone(asset, 'This photo was deleted');
  if (!isAvailable || !asset) return null;
  return <PhotoTagsEditor asset={asset} navigation={navigation} />;
}

function PhotoTagsEditor({ asset, navigation }) {
  const [draft, setDraft] = useState(asset.tags ?? []);
  // The stored list the draft started from: while the draft still equals it, nothing is pending.
  const baselineRef = useRef(draft);
  const { retag, isRunning, error } = useRetag(asset);
  const { flush } = useSaveAsYouType(draft, saveTags);

  const liveKey = JSON.stringify(asset.tags ?? []);

  // Tags that change underneath (a sync from another device, Tag it elsewhere) replace the draft
  // while nothing is pending, so the next edit starts from them instead of overwriting them.
  useEffect(() => {
    if (JSON.stringify(draft) !== JSON.stringify(baselineRef.current)) return;
    baselineRef.current = asset.tags ?? [];
    setDraft(baselineRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the live list only
  }, [liveKey]);

  // `asset` is live: a list it already holds (the one Tag again stored, say) isn't written again.
  async function saveTags(next) {
    baselineRef.current = next;
    if (JSON.stringify(next) === JSON.stringify(asset.tags)) return;
    await setTags(getDb(), asset.id, next);
  }

  // The only writer while it runs (the field takes no changes): the draft is stored first, then
  // replaced by the new tags, so it never writes the old ones back over them.
  async function handleRetag() {
    const tags = await retag(flush);
    if (tags) setDraft(tags);
  }

  return (
    <Page>
      <FloatingDetailHeader title="Photo tags" onBack={() => navigation.goBack()} />
      <DetailScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Field label="Tags" description={error ?? DESCRIPTION}>
          <TagsField
            tags={draft}
            onChange={setDraft}
            placeholder={asset.tags === null ? 'Not tagged yet' : 'No tags'}
            maxTags={ASSET_TAG_LIMITS.tags}
            maxTagLength={ASSET_TAG_LIMITS.tag}
            isDisabled={isRunning}
          />
        </Field>
        <TextButton label="Tag again" icon="sparkle" onPress={handleRetag} loading={isRunning} />
      </DetailScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 24,
  },
});
