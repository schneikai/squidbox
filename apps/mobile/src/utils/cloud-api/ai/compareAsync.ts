import type {
  AiModelKind,
  CompareVisionRequest,
  CompareVisionResponse,
  CompareWritingRequest,
  CompareWritingResponse,
} from '@squidbox/shared';

import { AI_REQUEST_TIMEOUT_MS } from './aiRequestTimeout';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

type CompareOptions = { signal?: AbortSignal };

/**
 * A blind compare of `kind`: writing `{ prompt, modelIds }`, vision `{ prompt, image: { base64,
 * mimeType }, modelIds }` → each model's `{ modelId, tweets | tags }` or `{ modelId, error }`.
 */
export default async function compareAsync(
  kind: AiModelKind,
  body: CompareWritingRequest | CompareVisionRequest,
  { signal }: CompareOptions = {},
): Promise<CompareWritingResponse['results'] | CompareVisionResponse['results']> {
  const { data } = await apiWithAuthentication.post<CompareWritingResponse | CompareVisionResponse>(
    `ai/compare/${kind}`,
    body,
    {
      timeout: AI_REQUEST_TIMEOUT_MS,
      signal,
    },
  );
  return data.results;
}
