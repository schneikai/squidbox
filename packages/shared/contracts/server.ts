// The two answers the server writes outside the routes' own contracts: its health check and the one
// error envelope every failed request gets.
import { z } from 'zod';

// GET /up (outside the /api/v1 prefix): the server's stable identity (SERVER_ID), which a session is
// bound to.
export const upResponseSchema = z.object({ status: z.literal('ok'), serverId: z.uuid() });
export type UpResponse = z.infer<typeof upResponseSchema>;

// What went wrong, by kind (apps/server/src/errors.ts throws them as AppError).
export const apiErrorCodeSchema = z.enum([
  'validation_error',
  'unauthorized',
  'invalid_credentials',
  'invalid_token',
  'not_found',
  'rate_limited',
  'purged',
  's3_error',
  'ai_not_configured',
  'ai_unavailable',
  'ai_not_allowed',
  'ai_admin_not_allowed',
  'developer_only',
  'read_only_library',
  'internal',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

// Every failed request's body: { error: { code, message } }.
export const apiErrorSchema = z.object({ error: z.object({ code: apiErrorCodeSchema, message: z.string() }) });
export type ApiError = z.infer<typeof apiErrorSchema>;
