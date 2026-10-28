import { VERIFIED_MODELS } from '@squidbox/shared';

/** Whether Squidbox checked the model with this id for this kind itself (VERIFIED_MODELS). */
export default function isVerifiedModel(kind, id) {
  return VERIFIED_MODELS[kind].some((model) => model.id === id);
}
