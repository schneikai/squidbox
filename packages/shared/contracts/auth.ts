// Auth wire contract — the request/response shapes shared by the app and the server (camelCase).
import { z } from 'zod';

// The extras an account sees on top of the defaults (users.features): `ai` may use the AI endpoints
// (and so the server's Venice key), `model_testing` shows Settings → Assistant → Testing.
export const ACCOUNT_FEATURES = ['ai', 'model_testing'] as const;
export type AccountFeature = (typeof ACCOUNT_FEATURES)[number];

export const apiUserSchema = z.object({
  id: z.string(), // uuid; the app treats it as opaque
  email: z.string(),
  // Plain strings, so an app ignores a feature newer than itself. Missing from a server older than
  // the column: none.
  features: z.array(z.string()).default([]),
});
export type ApiUser = z.infer<typeof apiUserSchema>;

export const loginRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// serverId is the server's stable identity (SERVER_ID); the app binds the session to it.
export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: apiUserSchema,
  serverId: z.string(),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

// Refresh returns tokens only, no user.
export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const userResponseSchema = z.object({
  user: apiUserSchema,
  serverId: z.string(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;
