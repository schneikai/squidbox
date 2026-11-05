import { type Context, use } from 'react';

/** The value of a context its provider always gives; throws `hint` when no provider is above. */
export default function useRequiredContext<T>(context: Context<T | null>, hint: string): T {
  const value = use(context);
  if (value === null) throw new Error(hint);
  return value;
}
