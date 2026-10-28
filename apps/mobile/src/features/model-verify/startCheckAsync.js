import { CHECK_JUDGE_MODEL_ID, CHECK_TURNS } from '@squidbox/shared';
import { Alert } from 'react-native';

import checkCostText from './checkCostText';

import findCatalogModel from '@/utils/ai/findCatalogModel';
import startModelCheckAsync from '@/utils/cloud-api/ai/startModelCheckAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';

/**
 * Asks the admin to run `model`'s check of `kind` (a catalog model; `catalog` holds the judge), with
 * what it asks for and about what it costs, then starts it on the server. The running check, or null
 * when the admin declined or the start failed (an alert says why).
 */
export default async function startCheckAsync(kind, model, catalog) {
  const judge = findCatalogModel(catalog, CHECK_JUDGE_MODEL_ID);
  const cost = checkCostText(kind, model, judge);
  const asks =
    kind === 'vision'
      ? `${CHECK_TURNS.vision} photos tagged by ${model.name}`
      : `${CHECK_TURNS.writing} replies from ${model.name}, each judged by ${judge?.name ?? CHECK_JUDGE_MODEL_ID}`;
  const isConfirmed = await confirmAsync({
    title: 'Run check',
    message: `${asks}, about ${cost}. It takes a minute or two.`,
    action: 'Run',
  });
  if (!isConfirmed) return null;
  try {
    return await startModelCheckAsync(kind, model.id);
  } catch (error) {
    Alert.alert("Couldn't start the check", apiErrorMessage(error));
    return null;
  }
}
