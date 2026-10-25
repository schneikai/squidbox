import Fastify, { type FastifyServerOptions } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { loadConfig } from './config.js';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { authRoutes } from './auth/routes.js';
import { assetRoutes } from './storage/routes.js';
import { syncRoutes } from './sync/routes.js';
import { aiRoutes } from './ai/routes.js';

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
    bodyLimit: 1024 * 1024, // JSON routes only (the upload route streams; see storage/routes.ts)
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(rateLimit, { global: false });

  registerErrorHandler(app);

  const { SERVER_ID: serverId } = loadConfig();
  app.get('/up', async () => ({ status: 'ok', serverId }));

  await app.register(
    async (api) => {
      await authRoutes(api);
      await assetRoutes(api);
      await syncRoutes(api);
      await aiRoutes(api);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
