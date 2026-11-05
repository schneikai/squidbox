import type { ApiError } from '@squidbox/shared';

// axios's `error.response`, as far as the app reads it.
export type ServerAnswer = { status?: number; data?: Partial<ApiError> };

/**
 * The server's answer an error carries (axios's `error.response`): its status and, when the server
 * sent one, its error envelope. Read by shape: the tests throw plain errors shaped like axios's, so
 * axios.isAxiosError would miss them.
 */
export default function errorResponse(error: unknown): ServerAnswer | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as { response?: ServerAnswer }).response;
}
