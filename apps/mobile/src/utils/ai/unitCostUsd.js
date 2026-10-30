/** What one unit of `model`'s work for `kind` costs in US dollars: a reply, or for vision a photo. */
export default function unitCostUsd(model, kind) {
  return kind === 'vision' ? model.costPer100PhotosUsd / 100 : model.costPerReplyUsd;
}
