import { uniqueTags } from '@squidbox/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import editTagsAsync from './editTagsAsync';

import useHaptics from '@/hooks/useHaptics';

/**
 * The tags of `rows` (live assets) as one list to edit in place, the union of theirs: `tags`, and
 * `change(next)`, which stores the difference at once: a tag taken out leaves every photo that has
 * it, one added goes on every photo with room (editTagsAsync). Until the live rows catch up, the
 * list shows the change; a change that comes in from elsewhere (a sync, Tag again) shows as it lands.
 */
export default function usePhotoTagsEdit(rows) {
  const haptics = useHaptics();
  const live = useMemo(() => uniqueTags(rows.flatMap((row) => row.tags ?? [])), [rows]);
  const liveKey = JSON.stringify(live);
  const liveKeyRef = useRef(liveKey);
  liveKeyRef.current = liveKey;
  // What a change shows until the rows hold it: `{ tags, sinceKey }`, sinceKey null while writing.
  const [pending, setPending] = useState(null);
  const writing = useRef(0);

  useEffect(() => {
    setPending((current) => (current?.sinceKey != null && current.sinceKey !== liveKey ? null : current));
  }, [liveKey]);

  const tags = pending?.tags ?? live;

  function change(next) {
    const edit = difference(tags, next);
    if (edit.add.length === 0 && edit.remove.length === 0) return;
    const removed = new Set(edit.remove.map(keyOf));
    const ids = rows
      .filter((row) => edit.add.length > 0 || row.tags?.some((tag) => removed.has(keyOf(tag))))
      .map((row) => row.id);
    const startKey = liveKeyRef.current;
    setPending({ tags: next, sinceKey: null });
    writing.current += 1;
    editTagsAsync(ids, edit)
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

// What turns `from` into `to`, by tag in any case.
function difference(from, to) {
  const fromKeys = new Set(from.map(keyOf));
  const toKeys = new Set(to.map(keyOf));
  return {
    add: to.filter((tag) => !fromKeys.has(keyOf(tag))),
    remove: from.filter((tag) => !toKeys.has(keyOf(tag))),
  };
}

function keyOf(tag) {
  return tag.trim().toLowerCase();
}
