import envelopeMessage from './envelopeMessage';
import errorResponse from './errorResponse';

/** What went wrong with a server call: the server's `{ error: { message } }` when it sent one. */
export default function apiErrorMessage(error: unknown): string {
  return (
    envelopeMessage(errorResponse(error)?.data) ??
    (error as { message?: string } | null | undefined)?.message ??
    'Something went wrong'
  );
}
