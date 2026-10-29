import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import modelKindText from './modelKindText';

import TextButton from '@/components/TextButton';
import { SectionFooter } from '@/components/settings-list/SettingsList';
import useHaptics from '@/hooks/useHaptics';
import applyAiCatalog from '@/lib/applyAiCatalog';
import useLibrary from '@/library/useLibrary';
import { getDb } from '@/sync/db/client';
import { clearPicksEqualTo } from '@/sync/modelChoicesRepository';
import { requestSync } from '@/sync/worker';
import modelsOfKind from '@/utils/ai/modelsOfKind';
import setModelDefaultsAsync from '@/utils/cloud-api/ai/setModelDefaultsAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';

// "<lead> A, or B for Adult content." or, for one model, "<lead> A." (`names` by variant).
function usesText(lead, { regular, unrestricted }) {
  return regular === unrestricted ? `${lead} ${regular}.` : `${lead} ${regular}, or ${unrestricted} for Adult content.`;
}

/**
 * The end of a model list of `kind`: what everyone uses now (`defaults`, the published defaults),
 * and while this account's picks (`yourDefaults`) differ, Make default for everyone, which confirms
 * and publishes both picks of the kind for every account. After a publish the picks equal to it are
 * cleared, so this account follows the published defaults again. `catalog` names the models; a
 * published default Venice dropped shows by its id.
 */
export default function MakeDefaultForEveryone({ kind, catalog, defaults, yourDefaults }) {
  const haptics = useHaptics();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const [isPublishing, setIsPublishing] = useState(false);

  const text = modelKindText[kind];
  const published = defaults[kind];
  const picked = yourDefaults[kind];
  const isChanged = picked.regular !== published.regular || picked.unrestricted !== published.unrestricted;
  const models = modelsOfKind(catalog, kind);
  const nameOf = (id) => models.find((model) => model.id === id)?.name ?? id;
  const namesOf = ({ regular, unrestricted }) => ({ regular: nameOf(regular), unrestricted: nameOf(unrestricted) });

  // The picks become the kind's defaults for every account; the picks equal to them are cleared (one
  // changed meanwhile on a model page stays).
  async function handlePublish() {
    const isConfirmed = await confirmAsync({
      title: 'Make default for everyone?',
      message: usesText(text.everyAccountUses, namesOf(picked)),
      action: 'Make default for everyone',
    });
    if (!isConfirmed) return;
    setIsPublishing(true);
    try {
      const answer = await setModelDefaultsAsync(kind, picked);
      applyAiCatalog(answer);
      await clearPicksEqualTo(getDb(), userId, kind, answer.defaults[kind]);
      requestSync();
      haptics.success();
    } catch (error) {
      haptics.error();
      Alert.alert("Couldn't make it the default for everyone", apiErrorMessage(error));
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <>
      <SectionFooter>{usesText(text.everyoneUses, namesOf(published))}</SectionFooter>
      {isChanged && (
        <View style={styles.actions}>
          <TextButton label="Make default for everyone" onPress={handlePublish} loading={isPublishing} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    paddingTop: 24,
  },
});
