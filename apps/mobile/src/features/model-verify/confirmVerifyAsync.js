import { VERIFY_JUDGE_MODEL_ID } from '@squidbox/shared';
import { Alert } from 'react-native';

import startVerifyRunAsync from '@/utils/cloud-api/ai/startVerifyRunAsync';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import confirmAsync from '@/utils/confirmAsync';

/**
 * Asks the admin to Verify `model` for `kind` (a catalog model; `estimate` its verifyEstimate), with
 * what it asks for and about what it costs, then starts it on the server. A start while one already
 * runs answers that one (the server starts nothing new). The server's answer (`{ run, plan }`, the
 * running run), or null when the admin declined or the start failed (an alert says why).
 */
export default async function confirmVerifyAsync(kind, model, { turns, judge, costText }) {
  const asks =
    kind === 'vision'
      ? `${turns} photos tagged by ${model.name}`
      : `${turns} replies from ${model.name}, each judged by ${judge?.name ?? VERIFY_JUDGE_MODEL_ID}`;
  const isConfirmed = await confirmAsync({
    title: `Verify ${model.name}`,
    message: `${asks} · ${costText}. It takes a minute or two.`,
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
