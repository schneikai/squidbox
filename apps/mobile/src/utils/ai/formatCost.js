import centsText from '@/utils/ai/centsText';

/** A model's cost line for its kind, in cents: "0.04¢ a reply", "0.02¢ a photo". */
export default function formatCost(model, kind) {
  const isVision = kind === 'vision';
  const usd = isVision ? model.costPer100PhotosUsd / 100 : model.costPerReplyUsd;
  return `${centsText(usd)} ${isVision ? 'a photo' : 'a reply'}`;
}
