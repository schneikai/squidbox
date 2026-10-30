/**
 * The id of the model of `kind` the assistant uses for this account (`yourDefaults`, useYourDefaults'):
 * the Uncensored default when the persona has adult content, else the Default; null while either
 * loads (`persona` undefined).
 */
export default function usedModelId(yourDefaults, kind, persona) {
  if (!yourDefaults || persona === undefined) return null;
  return yourDefaults[kind][persona?.adultContent ? 'unrestricted' : 'regular'];
}
