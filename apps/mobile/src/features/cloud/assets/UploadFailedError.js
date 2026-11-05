// The error a refused upload rejects with: the server's `message`, its HTTP `status` and its error
// `code` (`read_only_library`, `rate_limited`…), so a caller decides on the status, never on the text.
export default class UploadFailedError extends Error {
  constructor(message, { status, code = null }) {
    super(message);
    this.name = 'UploadFailedError';
    this.status = status;
    this.code = code;
  }
}
