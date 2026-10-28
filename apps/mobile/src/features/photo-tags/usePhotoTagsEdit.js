import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import editTagsAsync from './editTagsAsync';

import useHaptics from '@/hooks/useHaptics';
import tagsDifference from '@/utils/tagsDifference';

/**
 * The tags of `asset` (its live row) to edit in place: `tags`, and `change(next)`, which stores the
 * difference at once (editTagsAsync). Until the live row catches up, the list shows the change; a
 * change that comes in from elsewhere (a sync, Tag again) shows as it lands.
 */
export default function usePhotoTagsEdit(asset) {
  const haptics = useHaptics();
  const live = asset.tags ?? [];
  const liveKey = JSON.stringify(live);
  const liveKeyRef = useRef(liveKey);
  liveKeyRef.current = liveKey;
  // What a change shows until the row holds it: `{ tags, sinceKey }`, sinceKey null while writing.
  const [pending, setPending] = useState(null);
  const writing = useRef(0);

  useEffect(() => {
    setPending((current) => (current?.sinceKey != null && current.sinceKey !== liveKey ? null : current));
  }, [liveKey]);

  const tags = pending?.tags ?? live;

  function change(next) {
    const edit = tagsDifference(tags, next);
    if (edit.add.length === 0 && edit.remove.length === 0) return;
    const startKey = liveKeyRef.current;
    setPending({ tags: next, sinceKey: null });
    writing.current += 1;
    editTagsAsync(asset.id, edit)
      .then(
        () => {
          if (writing.current > 1) return;
          setPending((current) =>
            liveKeyRef.current !== startKey ? null : current && { ...current, sinceKey: startKey },
          );
        },
        (error) => {
          console.error('Saving the tags failed', error);
          haptics.error();
          Alert.alert("Couldn't save your changes", error.message);
          setPending(null);
        },
      )
      .finally(() => {
        writing.current -= 1;
      });
  }

  return { tags, change };
}
