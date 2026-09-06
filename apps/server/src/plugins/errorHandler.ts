import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError, errorBody } from '../errors.js';

// Renders every error as the single envelope { error: { code, message } }.
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    // Request validation failures (zod type provider).
    if (hasZodFastifySchemaValidationErrors(error)) {
      const message = error.validation
        .map((v) => `${v.instancePath || v.params?.issue?.path?.join('.') || 'body'}: ${v.message}`)
        .join('; ');
      return reply.code(400).send(errorBody('validation_error', message || 'Invalid request'));
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message));
    }

    // Rate limiter (and other framework errors that carry a statusCode).
    if (error.statusCode === 429) {
      return reply.code(429).send(errorBody('rate_limited', 'Too many requests'));
    }
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send(errorBody('validation_error', error.message));
    }

    request.log.error({ err: error }, 'Unhandled error');
    return reply.code(500).send(errorBody('internal', 'Internal server error'));
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send(errorBody('not_found', 'Route not found'));
  });
}
