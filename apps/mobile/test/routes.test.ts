import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Expo Router's own route tree and path matching, run over the real `src/app/` files.
const require = createRequire(import.meta.url);
const { getStateFromPath } = require('expo-router/build/fork/getStateFromPath');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const { getRoutes } = require('expo-router/build/getRoutesCore');

type State = { routes: { name: string; state?: State }[]; index?: number };

const appDir = new URL('../src/app/', import.meta.url);
const files = readdirSync(appDir, { recursive: true, encoding: 'utf8' }).filter((file) => /\.tsx?$/.test(file));

// Each file as the routes it makes: an array group (`(main,new-post)`) makes one per group.
const routes = files
  .filter((file) => !/_layout\.tsx?$/.test(file))
  .flatMap((file) => expandGroups(file.replace(/\.tsx?$/, '')));

const context = Object.assign(() => ({ default: () => null }), {
  keys: () => files.map((file) => `./${file}`),
  resolve: (key: string) => key,
});
const tree = getRoutes(context, {
  platform: 'ios',
  importMode: 'sync',
  getSystemRoute: ({ type, route }: { type: string; route: string }) => ({
    type,
    route,
    contextKey: route,
    loadRoute: () => ({ default: () => null }),
    children: [],
    dynamic: null,
  }),
});
// The app's linking config keeps every route under the root layout's slot.
const config = { screens: { __root: { path: '', ...getReactNavigationConfig(tree, false) } } };

// The route a link to `path` opens, as `group/…/name`, from a screen at `segments`.
function resolve(path: string, segments: string[]) {
  const names = [];
  let state: State | undefined = getStateFromPath(path, config, segments).routes[0].state;
  while (state) {
    const route = state.routes[state.index ?? state.routes.length - 1];
    names.push(route.name);
    state = route.state;
  }
  return names.join('/');
}

function expandGroups(route: string): string[] {
  const match = route.match(/\(([^)]*,[^)]*)\)/);
  if (!match) return [route];
  return match[1].split(',').flatMap((group) => expandGroups(route.replace(match[0], `(${group})`)));
}

const groupsOf = (route: string) => route.split('/').filter((segment) => segment.startsWith('('));
const urlOf = (route: string) =>
  route
    .split('/')
    .filter((segment) => !segment.startsWith('(') && segment !== 'index')
    .map((segment) => segment.replace(/^\[(.+)\]$/, '$1'))
    .join('/');
const isPrefix = (prefix: string[], of: string[]) => prefix.every((group, i) => of[i] === group);

const copiesByUrl = Map.groupBy(routes, urlOf);
const sharedUrls = [...copiesByUrl].filter(([, copies]) => copies.length > 1);

describe('routes', () => {
  it('has screens that open in more than one place', () => {
    expect(sharedUrls.length).toBeGreaterThan(0);
  });

  // Outside the sheets that hold their own copy, a link opens one copy, whichever screen it comes
  // from: without a copy in `(main)`, Expo Router would pick one of the sheets' by file order.
  it.each(sharedUrls)('opens /%s from the main app in its one copy there', (url, copies) => {
    const mainCopies = copies.filter((copy) => groupsOf(copy)[0] === '(main)');
    expect(mainCopies).toHaveLength(1);
    expect(resolve(`/${url}`, ['(main)', '(tabs)', 'posts'])).toBe(mainCopies[0]);
  });

  // A screen opened inside a sheet pushes inside it, never behind it: from any screen, a link to a
  // shared screen opens the copy in the closest group around that screen (the sheet's, else the
  // main app's).
  it.each(sharedUrls)('opens /%s in the copy of the sheet it is opened from', (url, copies) => {
    for (const from of routes) {
      const fromGroups = groupsOf(from);
      const closest = copies
        .filter((copy) => isPrefix(groupsOf(copy), fromGroups))
        .sort((a, b) => groupsOf(b).length - groupsOf(a).length);
      if (closest.length === 0) continue;
      expect(
        resolve(
          `/${url}`,
          from.split('/').filter((s) => s !== 'index'),
        ),
        `from ${from}`,
      ).toBe(closest[0]);
    }
  });
});
