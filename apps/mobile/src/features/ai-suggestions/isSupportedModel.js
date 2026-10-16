// Chat completions model families that support strict json_schema structured outputs.
const SUPPORTED_FAMILIES = /^(gpt-4o|gpt-4\.1|gpt-5|o\d)/;
// Members of those families that aren't text chat models, need the Responses API, or predate structured outputs.
const UNSUPPORTED_VARIANTS =
  /audio|realtime|search|transcribe|tts|image|codex|-pro|deep-research|o1-mini|o1-preview|gpt-4o-2024-05-13/;

/** Whether the AI suggestions can use this OpenAI model, also when it is fine-tuned from a supported one. */
export default function isSupportedModel(modelId) {
  // A fine-tuned id is `ft:<base model>:<org>:<suffix>:<id>`; only the base model decides.
  const baseModel = (modelId ?? '').replace(/^ft:/, '').split(':')[0];
  return SUPPORTED_FAMILIES.test(baseModel) && !UNSUPPORTED_VARIANTS.test(baseModel);
}
