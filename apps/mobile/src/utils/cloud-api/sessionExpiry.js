const listeners = new Set();

// Subscribe to "the server rejected this device's session". Returns the unsubscribe function.
export function onSessionExpired(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySessionExpired() {
  for (const listener of listeners) listener();
}
