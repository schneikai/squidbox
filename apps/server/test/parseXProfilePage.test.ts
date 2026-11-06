import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseXProfilePage } from '../src/contacts/parseXProfilePage.js';

// Synthetic pages built to x.com's structure (fixtures/x-profile), never a real person's.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/x-profile/${name}`, import.meta.url), 'utf8');
const available = fixture('available.html');

describe('parseXProfilePage', () => {
  it('reads a public profile from the page', () => {
    expect(parseXProfilePage(available)).toEqual({
      status: 'found',
      isProtected: false,
      name: 'Maya Lindqvist 🌲',
      bio: "Trail runs and tide pools <3 · Maya's camera roll https://bsky.app/profile/Maya.bsky.social",
      location: 'Squamish, BC',
      website: 'https://onlyfans.com/mayal/c17',
      avatarUrl: 'https://pbs.twimg.com/profile_images/1/abc_normal.jpg',
    });
  });

  it('reads a profile X hides from signed-out readers as unavailable', () => {
    expect(parseXProfilePage(fixture('unavailable.html'))).toEqual({ status: 'unavailable' });
  });

  it('reads a page without the profile as failed, with the reason', () => {
    expect(parseXProfilePage('<html><title>X</title></html>')).toEqual({
      status: 'failed',
      reason: 'no profile status on the page',
    });
  });

  it('still reads the profile without the full Relay record, without the website', () => {
    // The page with its second Result.Ok record ($R[16], the full one) cut out.
    const withoutFull =
      available.slice(0, available.indexOf(',$R[16]=')) + available.slice(available.indexOf(',$R[23]='));
    expect(parseXProfilePage(withoutFull)).toMatchObject({
      status: 'found',
      name: 'Maya Lindqvist 🌲',
      bio: expect.stringContaining('https://t.co/abc123'),
      location: 'Squamish, BC',
      website: '',
    });
  });

  it('takes the name and bio from the meta tags when the profile object has none', () => {
    const page = available
      .replace('name:"Maya Lindqvist 🌲"', 'name:null')
      .replace(/description:"[^"]*"/, 'description:null');
    expect(parseXProfilePage(page)).toMatchObject({
      status: 'found',
      name: 'Maya Lindqvist 🌲',
      bio: "Trail runs and tide pools <3 · Maya's camera roll https://bsky.app/profile/Maya.bsky.social",
    });
  });

  it('reads a protected profile as found, marked protected', () => {
    const page = parseXProfilePage(
      available.replace('profileStatus:"Available"', 'profileStatus:"ProtectedFromViewer"'),
    );
    expect(page).toMatchObject({ status: 'found', isProtected: true, name: 'Maya Lindqvist 🌲' });
  });

  it('reads a profile string with an escape it does not know as failed, with the reason', () => {
    const page = parseXProfilePage(available.replace('location:"Squamish, BC"', String.raw`location:"Squamish\q"`));
    expect(page).toEqual({ status: 'failed', reason: 'unknown escape \\q' });
  });

  it("reads the profile's own fields, not those of an object nested in it before its status", () => {
    const page = available.replace(
      'affiliateLabelDescription:null',
      'affiliateLabelDescription:$R[9]={name:"Wrong \\"quoted\\" }",location:"Elsewhere",avatarUrl:"https://evil.test/a.jpg"}',
    );
    expect(parseXProfilePage(page)).toMatchObject({
      status: 'found',
      name: 'Maya Lindqvist 🌲',
      location: 'Squamish, BC',
      avatarUrl: 'https://pbs.twimg.com/profile_images/1/abc_normal.jpg',
    });
  });

  it('reads a profile object that never closes as failed', () => {
    const page = available.slice(0, available.indexOf('profileStatus:"Available"') + 40);
    expect(parseXProfilePage(page).status).toBe('failed');
  });
});
