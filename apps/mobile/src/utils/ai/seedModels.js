import isVerifiedModel from './isVerifiedModel';

// The vision list's first run after the default model: the owner's starting picks. The only model
// ids in the app: the verified models and the defaults come with the catalog (the server's marks),
// everything else from Venice's catalog.
const VISION_SEED_IDS = ['venice-uncensored-1-2', 'deepseek-v4-1-flash-uncensored', 'qwen-3-6-plus'];

/**
 * Your models on first run, of those the catalog of this kind still offers: for writing the verified
 * models, the regular default first, whatever the Adult content switch says (it picks only the
 * default); for vision the default model, then the owner's starting list.
 */
export default function seedModels(catalogOfKind, kind, defaults) {
  const first = defaults[kind].regular;
  const ids =
    kind === 'writing'
      ? [first, ...catalogOfKind.filter((model) => isVerifiedModel('writing', model)).map(({ id }) => id)]
      : [first, ...VISION_SEED_IDS];
  return [...new Set(ids)].flatMap((id) => catalogOfKind.filter((model) => model.id === id));
}
