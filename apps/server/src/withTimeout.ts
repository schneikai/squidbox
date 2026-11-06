/** Aborted after `ms`, or sooner with `signal`. */
export function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  return signal ? AbortSignal.any([AbortSignal.timeout(ms), signal]) : AbortSignal.timeout(ms);
}
