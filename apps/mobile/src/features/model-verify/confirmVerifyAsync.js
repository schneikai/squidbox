import { VERIFY_JUDGE_MODEL_ID, VERIFY_TURNS } from '@squidbox/shared';
import { Alert } from 'react-native';

import findCatalogModel from './findCatalogModel';
import verifyCostText from './verifyCostText';

import fetchVerifyRunAsync from '@/utils/cloud-api/ai/fetchVerifyRunAsync';
import startVerifyRunAsync from '@/utils/cloud-api/ai/startVerifyRunAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';

/**
 * Asks the admin to Verify `model` for `kind` (a catalog model; `catalog` holds the judge), with what
 * it asks for and about what it costs, then starts it on the server. A Verify already running is
 * answered as it is, without the question (nothing new would start or cost). The server's answer
 * (`{ run, plan }`, the running run), or null when the admin declined or the start failed (an alert
 * says why).
 */
export default async function confirmVerifyAsync(kind, model, catalog) {
  try {
    const latest = await fetchVerifyRunAsync(kind, model.id);
    if (latest.run?.status === 'running') return latest;
  } catch (error) {
    Alert.alert("Couldn't start Verify", apiErrorMessage(error));
    return null;
  }
  const judge = findCatalogModel(catalog, VERIFY_JUDGE_MODEL_ID);
  const asks =
    kind === 'vision'
      ? `${VERIFY_TURNS.vision} photos tagged by ${model.name}`
      : `${VERIFY_TURNS.writing} replies from ${model.name}, each judged by ${judge?.name ?? VERIFY_JUDGE_MODEL_ID}`;
  const isConfirmed = await confirmAsync({
    title: `Verify ${model.name}`,
    message: `${asks} · ${verifyCostText(kind, model, judge)}. It takes a minute or two.`,
    action: 'Verify',
  });
  if (!isConfirmed) return null;
  try {
    return await startVerifyRunAsync(kind, model.id);
  } catch (error) {
    Alert.alert("Couldn't start Verify", apiErrorMessage(error));
    return null;
  }
}
