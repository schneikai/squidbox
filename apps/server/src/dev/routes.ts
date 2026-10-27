import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { loginRequestSchema } from '@squidbox/shared';
import { z } from 'zod';
import { verifyPassword } from '../auth/passwords.js';
import { getDb } from '../db/client.js';
import { AppError } from '../errors.js';
import { findUserByEmail } from '../users.js';
import { copyLiveLibraryIfMissing, isLibraryCopy } from './libraryCopy.js';

// Local dev only (registered when LIBRARY_COPY_EMAIL is set). The dev client calls it before it signs
// in as the library-copy account, with that account's login.
export async function devRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const db = getDb();

  // POST /dev/library-copy: copies the owner's live library into the copy account the first time.
  r.route({
    method: 'POST',
    url: '/dev/library-copy',
    schema: { body: loginRequestSchema, response: { 200: z.object({ copied: z.boolean() }) } },
    handler: async (request) => {
      const { email, password } = request.body;
      const user = await findUserByEmail(db, email);
      if (!user || !isLibraryCopy(user) || !(await verifyPassword(password, user.passwordDigest))) {
        throw AppError.invalidCredentials();
      }
      return { copied: await copyLiveLibraryIfMissing(db, user) };
    },
  });
}
