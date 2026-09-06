import Fastify, { type FastifyServerOptions } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { authRoutes } from './auth/routes.js';
import { assetRoutes } from './storage/routes.js';

// Strip a `token` query param so access tokens sent via ?token= (iOS background uploads)
// never land in request logs.
function redactUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.replace(/([?&]token=)[^&]*/gi, '$1[REDACTED]');
}

export async function buildApp(opts: { logger?: FastifyServerOptions['logger'] } = {}) {
  const app = Fastify({
    logger: opts.logger ?? {
      level: process.env.LOG_LEVEL ?? 'info',
      serializers: {
        req(req) {
          return { method: req.method, url: redactUrl(req.url), remoteAddress: req.ip };
        },
      },
    },
    // We stream large uploads through request.raw; the body is never buffered by Fastify.
    bodyLimit: 1024 * 1024, // JSON routes only (uploads bypass this via the raw parser below)
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Pass raw binary bodies (uploads) straight through as a stream instead of buffering them.
  // JSON keeps its built-in parser; this only catches other content types.
  app.addContentTypeParser('*', (_request, payload, done) => done(null, payload));

  await app.register(rateLimit, { global: false });

  registerErrorHandler(app);

  app.get('/up', async () => ({ status: 'ok' }));

  await app.register(
    async (api) => {
      await authRoutes(api);
      await assetRoutes(api);
    },
    { prefix: '/api/v1' }
  );

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
