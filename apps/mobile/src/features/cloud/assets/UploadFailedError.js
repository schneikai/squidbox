// What the upload route answers the same way on every try: a bad request, a refused library (the dev
// copy's read_only_library), a missing route, a purged key, a file over the limit. Anything else (a
// 401 after the refresh, a 429, a 5xx) may go through on a later try.
const REFUSED_STATUSES = new Set([400, 403, 404, 410, 413]);

// The error a refused upload rejects with: the server's `message`, its HTTP `status` and its error
// `code` (`read_only_library`, `rate_limited`…), so a caller decides on the status, never on the text.
export default class UploadFailedError extends Error {
  constructor(message, { status, code = null }) {
    super(message);
    this.name = 'UploadFailedError';
    this.status = status;
    this.code = code;
  }

  // Whether trying again would fail the same way (REFUSED_STATUSES).
  get isRefusal() {
    return REFUSED_STATUSES.has(this.status);
  }
}
