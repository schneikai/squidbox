import type { FastifyReply } from 'fastify';

/** Aborted once the app stops waiting (a closed compare, a sheet closed), so the calls it started stop too. */
export function untilClientLeaves(reply: FastifyReply): AbortSignal {
  const controller = new AbortController();
  reply.raw.on('close', () => {
    if (!reply.raw.writableFinished) controller.abort();
  });
  return controller.signal;
}
