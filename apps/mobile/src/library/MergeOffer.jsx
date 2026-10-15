import { useEffect } from 'react';
import { Alert } from 'react-native';

import deviceLabel from './deviceLabel';
import { isEmptyPlan } from './mergeLibrary';
import { mergeLibrary, planMergeOf } from './mergeRun';
import useLibrary from './useLibrary';

import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useCloud from '@/features/cloud/useCloud';
import { requestSync, withSyncPaused } from '@/sync/worker';
import pluralizeText from '@/utils/pluralizeText';

function offerText(plan, target) {
  const { alreadyInAccount, cloudOnly } = plan;
  const added = [
    pluralizeText('1 photo', '%{count} photos', plan.assets.length),
    pluralizeText('1 album', '%{count} albums', plan.albums.length),
    pluralizeText('1 post', '%{count} posts', plan.posts.length),
  ];
  const title = `Add ${added[0]}, ${added[1]} and ${added[2]} from ${deviceLabel()} to ${target.owner.email}?`;
  const notes = [];
  if (alreadyInAccount > 0) {
    notes.push(`${pluralizeText('1 photo is', '%{count} photos are', alreadyInAccount)} already in the account.`);
  }
  if (cloudOnly > 0) {
    notes.push(
      `${pluralizeText('1 photo is', '%{count} photos are', cloudOnly)} in another account's storage and ${cloudOnly === 1 ? 'stays' : 'stay'} here.`,
    );
  }
  return { title, message: notes.join('\n') || undefined };
}

// After a sign-in, once the account library has pulled: offers what this device's library holds to
// the account, once (library-ownership plan §1.5 (f)/(g)). A leaf of the app (so its state changes
// re-render nothing else), mounted with it, so it runs only after the first sync drained and
// duplicates can be seen. Renders nothing.
export default function MergeOffer() {
  const { mergeOffer, dismissMergeOffer } = useCloud();
  const { library, libraries } = useLibrary();
  const { showBlocking, hide } = useProgressOverlay();

  useEffect(() => {
    if (!mergeOffer || !library) return undefined;
    const source = libraries.find((entry) => entry.id === mergeOffer && entry.owner.kind === 'device');
    if (!source || library.owner.kind !== 'account') {
      dismissMergeOffer();
      return undefined;
    }
    let cancelled = false;

    async function addToAccount() {
      showBlocking();
      try {
        const { cloudOnly } = await withSyncPaused(() => mergeLibrary(source.id, library.id));
        requestSync();
        if (cloudOnly > 0) {
          Alert.alert(
            'Added to your account',
            `${pluralizeText('1 photo', '%{count} photos', cloudOnly)} in another account's storage stayed on ${deviceLabel()}.`,
          );
        }
      } catch (error) {
        Alert.alert("Couldn't add to your account", error.message);
      } finally {
        hide();
      }
    }

    planMergeOf(source.id, library.id).then(
      (plan) => {
        if (cancelled) return;
        dismissMergeOffer();
        if (isEmptyPlan(plan)) return;
        const { title, message } = offerText(plan, library);
        Alert.alert(title, message, [
          { text: 'Keep Separate', style: 'cancel' },
          { text: 'Add to Account', onPress: addToAccount },
        ]);
      },
      (error) => {
        if (cancelled) return;
        dismissMergeOffer();
        console.warn('Could not plan the merge', error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [mergeOffer, library?.id]);

  return null;
}
