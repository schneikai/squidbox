// Fetching a public X profile page for From link (parseXProfilePage reads it). The HTML is never
// stored or logged.
import type { FastifyBaseLogger } from 'fastify';
import { CONTACT_HANDLE_BY_FIELD } from '@squidbox/shared';
import { withTimeout } from '../withTimeout.js';
import { parseXProfilePage, type XProfilePage } from './parseXProfilePage.js';
import { readCappedBody } from './readCappedBody.js';
import { USER_AGENT } from './userAgent.js';

// The most of a page read: x.com's profile pages are 50–200 KB.
const PAGE_MAX_BYTES = 3 * 1024 * 1024;
const PAGE_TIMEOUT_MS = 8_000;

/**
 * The public X profile of `handle`, fetched anonymously with the app's own User-Agent: 404 is
 * `notFound`, a 200 page reads as parseXProfilePage says. A redirect (the page moved off x.com),
 * another status, a page past PAGE_MAX_BYTES or a fetch that throws (network, timeout, `signal`) is
 * `failed`, logged once as a warning; a hidden, missing or protected profile is logged at info, so
 * the share of them shows in the logs.
 */
export async function fetchXProfileAsync(
  handle: string,
  { signal, log }: { signal?: AbortSignal; log: Pick<FastifyBaseLogger, 'info' | 'warn'> },
): Promise<XProfilePage> {
  let httpStatus: number | null = null;
  let page: XProfilePage;
  try {
    const response = await fetch(CONTACT_HANDLE_BY_FIELD.xHandle.profileUrl(handle), {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      redirect: 'manual',
      signal: withTimeout(PAGE_TIMEOUT_MS, signal),
    });
    httpStatus = response.status;
    if (response.status !== 200) {
      await response.body?.cancel();
      page =
        response.status === 404
          ? { status: 'notFound' }
          : { status: 'failed', reason: `x.com answered ${response.status}` };
    } else {
      const body = await readCappedBody(response, PAGE_MAX_BYTES);
      page = body
        ? parseXProfilePage(body.toString('utf8'))
        : { status: 'failed', reason: `the page is larger than ${PAGE_MAX_BYTES / 1024 / 1024} MB` };
    }
  } catch (error) {
    page = { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
  if (page.status === 'failed')
    log.warn({ handle, httpStatus, reason: page.reason }, 'From link: x.com gave no readable profile');
  else if (page.status !== 'found')
    log.info({ handle, status: page.status }, 'From link: x.com shows no public profile');
  else if (page.isProtected) log.info({ handle }, 'From link: the profile is protected');
  return page;
}
