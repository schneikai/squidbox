import { PERSONA_DRAFT_MAX_POSTS, PERSONA_DRAFT_POST_MAX_LENGTH } from '@squidbox/shared';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import applyPersonaDraft from './applyPersonaDraft';
import draftedFields from './draftedFields';
import voiceFields from './voiceFields';

import useHaptics from '@/hooks/useHaptics';
import useYourModels from '@/hooks/useYourModels';
import { getDb } from '@/sync/db/client';
import { readRecentPostTexts } from '@/sync/postsRepository';
import draftPersonaAsync from '@/utils/cloud-api/ai/draftPersonaAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import isPresent from '@/utils/isPresent';

const draftedLabels = draftedFields.map((field) => voiceFields[field].label);
const DRAFTED_LABELS = `${draftedLabels.slice(0, -1).join(', ')} and ${draftedLabels.at(-1)}`;

/**
 * "Fill it in for me" on Writing as you: drafts the fields from the library's newest posts (or, with
 * none, from the example posts pasted in) with the chosen writing model, else the first of your
 * writing models Venice still has. Asks first whether to fill only the empty fields or replace them
 * all when any is filled. `draft` is the screen's, `onDraft(next)` takes the result.
 * `canFill` is false until there is a model to ask; `catalogError`/`retry` say why there isn't.
 */
export default function useFillInForMe(draft, onDraft) {
  const haptics = useHaptics();
  const { rows, chosenId, error: catalogError, retry } = useYourModels('writing');
  const [isDrafting, setIsDrafting] = useState(false);
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const available = rows?.filter((row) => row.model) ?? [];
  const modelId = (available.find((row) => row.id === chosenId) ?? available[0])?.id ?? null;

  async function fill() {
    if (!modelId || isDrafting) return;
    const libraryPosts = await readRecentPostTexts(getDb(), PERSONA_DRAFT_MAX_POSTS);
    const pasted = draft.examplePosts.map((post) => post.trim()).filter(Boolean);
    // The pasted posts are at most PERSONA_LIMITS.examplePosts, fewer than the server takes.
    const posts = (libraryPosts.length > 0 ? libraryPosts : pasted).map((post) =>
      post.slice(0, PERSONA_DRAFT_POST_MAX_LENGTH),
    );
    if (posts.length === 0) {
      Alert.alert('No posts yet', 'Paste a few of your posts under Example posts, then try again.');
      return;
    }
    const mode = draftedFields.some((field) => isPresent(draft[field])) ? await askModeAsync() : 'empty';
    if (!mode) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    setIsDrafting(true);
    try {
      const reply = await draftPersonaAsync({ posts, modelId }, { signal: controller.signal });
      // Applied to the draft as it is now: typing while it ran is kept, unless it's replaced.
      onDraft((current) => applyPersonaDraft(current, reply, posts, mode));
      haptics.success();
    } catch (error) {
      if (controller.signal.aborted || axios.isCancel(error)) return;
      haptics.error();
      Alert.alert("Couldn't fill it in", apiErrorMessage(error));
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setIsDrafting(false);
      }
    }
  }

  return { fill, isDrafting, canFill: !!modelId, catalogError, retry };
}

// Empty only, Replace all, or null for Cancel.
function askModeAsync() {
  return new Promise((resolve) => {
    Alert.alert(
      'Some fields are filled in',
      `Fill only the empty ones, or replace ${DRAFTED_LABELS} too?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Empty only', onPress: () => resolve('empty') },
        { text: 'Replace all', style: 'destructive', onPress: () => resolve('replace') },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
