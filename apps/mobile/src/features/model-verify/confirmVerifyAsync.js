import { VERIFY_JUDGE_MODEL_ID, verifyPlanTurns } from '@squidbox/shared';
import { Alert } from 'react-native';

import findCatalogModel from './findCatalogModel';
import verifyCostText from './verifyCostText';

import startVerifyRunAsync from '@/utils/cloud-api/ai/startVerifyRunAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';

/**
 * Asks the admin to Verify `model` for `kind` (a catalog model; `plan` the kind's, `catalog` holds the
 * judge), with what it asks for and about what it costs, then starts it on the server. A start while
 * one already runs answers that one (the server starts nothing new). The server's answer (`{ run,
 * plan }`, the running run), or null when the admin declined or the start failed (an alert says why).
 */
export default async function confirmVerifyAsync(kind, plan, model, catalog) {
  const turns = verifyPlanTurns(plan);
  const judge = findCatalogModel(catalog, VERIFY_JUDGE_MODEL_ID);
  const asks =
    kind === 'vision'
      ? `${turns} photos tagged by ${model.name}`
      : `${turns} replies from ${model.name}, each judged by ${judge?.name ?? VERIFY_JUDGE_MODEL_ID}`;
  const isConfirmed = await confirmAsync({
    title: `Verify ${model.name}`,
    message: `${asks} · ${verifyCostText(kind, plan, model, catalog)}. It takes a minute or two.`,
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
