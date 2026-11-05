// The stored session is not the one a piece of work runs for: it ended, or someone else signed in.
export default class SessionChangedError extends Error {
  constructor(message = 'The session changed') {
    super(message);
    this.name = 'SessionChangedError';
  }
}
