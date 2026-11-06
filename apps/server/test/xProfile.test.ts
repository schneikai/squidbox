import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseXProfilePage } from '../src/contacts/xProfile.js';

// Synthetic pages built to x.com's structure (fixtures/x-profile), never a real person's.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/x-profile/${name}`, import.meta.url), 'utf8');
const available = fixture('available.html');

describe('parseXProfilePage', () => {
  it('reads a public profile from the page', () => {
    expect(parseXProfilePage(available, 200)).toEqual({
      status: 'found',
      isProtected: false,
      name: 'Maya Lindqvist 🌲',
      bio: "Trail runs and tide pools <3 · Maya's camera roll https://bsky.app/profile/Maya.bsky.social",
      location: 'Squamish, BC',
      website: 'https://onlyfans.com/mayal/c17',
      avatarUrl: 'https://pbs.twimg.com/profile_images/1/abc_normal.jpg',
      links: ['https://onlyfans.com/mayal/c17', 'https://bsky.app/profile/Maya.bsky.social'],
    });
  });

  it('reads a profile X hides from signed-out readers as unavailable, with nothing in it', () => {
    expect(parseXProfilePage(fixture('unavailable.html'), 200)).toEqual({
      status: 'unavailable',
      isProtected: false,
      name: '',
      bio: '',
      location: '',
      website: '',
      avatarUrl: null,
      links: [],
    });
  });

  it('reads a 404 as notFound without reading the page', () => {
    expect(parseXProfilePage(available, 404).status).toBe('notFound');
  });

  it('reads a page without the profile as failed, with the reason', () => {
    const page = parseXProfilePage('<html><title>X</title></html>', 200);
    expect(page.status).toBe('failed');
    expect(page.reason).toBe('no profile status on the page');
  });

  it('still reads the profile without the full Relay record, without the website', () => {
    // The page with its second Result.Ok record ($R[16], the full one) cut out.
    const withoutFull =
      available.slice(0, available.indexOf(',$R[16]=')) + available.slice(available.indexOf(',$R[23]='));
    const page = parseXProfilePage(withoutFull, 200);
    expect(page).toMatchObject({ status: 'found', name: 'Maya Lindqvist 🌲', location: 'Squamish, BC', website: '' });
    expect(page.bio).toContain('https://t.co/abc123');
  });

  it('reads a protected profile as found, marked protected', () => {
    const page = parseXProfilePage(
      available.replace('profileStatus:"Available"', 'profileStatus:"ProtectedFromViewer"'),
      200,
    );
    expect(page).toMatchObject({ status: 'found', isProtected: true, name: 'Maya Lindqvist 🌲' });
  });

  it('reads a profile string with an escape it does not know as failed, with the reason', () => {
    const page = parseXProfilePage(
      available.replace('location:"Squamish, BC"', String.raw`location:"Squamish\q"`),
      200,
    );
    expect(page).toMatchObject({ status: 'failed', reason: 'unknown escape \\q' });
  });
});
