// Auth wire contract — the request/response shapes the mobile app depends on.
// These match what the (now-legacy) Rails API returned via olive_branch (camelCase).
// The server MUST keep these byte-compatible so the app can be pointed at it unchanged.
import { z } from 'zod';

export const apiUserSchema = z.object({
  id: z.string(), // uuid (was an integer in Rails; the app stores it opaquely)
  email: z.string(),
});
export type ApiUser = z.infer<typeof apiUserSchema>;

export const loginRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: apiUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

// Note: refresh returns NO user (parity with Rails).
export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const userResponseSchema = z.object({
  user: apiUserSchema,
});
export type UserResponse = z.infer<typeof userResponseSchema>;
