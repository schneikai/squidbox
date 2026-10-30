// The Postgres error behind a failed query.
export type DriverError = { code?: unknown; constraint?: unknown; cause?: DriverError };

/** The pg error, unwrapped from the `cause` that newer drizzle versions wrap it in (DrizzleQueryError). */
export function driverError(error: unknown): DriverError | undefined {
  const wrapped = error as DriverError | undefined;
  return wrapped?.code === undefined ? wrapped?.cause : wrapped;
}
