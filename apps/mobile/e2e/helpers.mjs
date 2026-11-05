/* eslint-env node, browser */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

// How long a drag-to-reorder holds before the item lifts, read from the app's source: Playwright's
// loader can't import src/constants.js (ESM syntax in a package without "type": "module").
const DRAG_LONG_PRESS_MS = readAppConstant('DRAG_LONG_PRESS_MS');

// Helpers for the UI flow tests. Screens under a pushed screen or a sheet, and the other tabs, stay
// in the page, so every lookup is scoped to its screen's testID.

// A name no earlier run left behind.
export function uniqueName(prefix) {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

// Switches the main tabs with the floating navigation bar (Library, Albums or Posts).
export async function openTab(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click();
}

export function assetCells(screen) {
  return screen.getByTestId('asset-cell');
}

// The asset id of each grid cell on `screen` that shows its thumbnail (`<id>thumb.jpg`), in order.
export function cellAssetIds(screen) {
  return assetCells(screen).evaluateAll((cells) =>
    cells.map((cell) => cell.querySelector('img')?.src.match(/([\w-]+)thumb\.jpg/)?.[1] ?? null),
  );
}

// A swipe to the next page of a horizontal pager. The web has no touch swipe a test can send over
// a photo (its gesture views take every touch), so a sideways mouse wheel scrolls the pager, and its
// scroll snap settles on the next page.
export async function swipeLeft(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(box.width, 0);
}

// Drag-to-reorder: a press held until the item lifts, moved onto `to`'s slot, and let go.
export async function dragCell(page, from, to) {
  const start = await centre(from);
  const end = await centre(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // The hold is part of the gesture: the item lifts only after it.
  await page.waitForTimeout(DRAG_LONG_PRESS_MS + 150);
  await page.mouse.move(end.x, end.y, { steps: 20 });
  await page.mouse.up();
}

// In an open Add media menu: From Squidbox, then the first `count` photos of the picker, added.
export async function pickFromSquidbox(page, count) {
  await page.getByRole('menuitem', { name: 'From Squidbox' }).click();
  const picker = page.getByTestId('asset-picker');
  const cells = assetCells(picker);
  for (let index = 0; index < count; index++) await cells.nth(index).click();
  await picker.getByRole('button', { name: `Add ${count}`, exact: true }).click();
  await picker.waitFor({ state: 'detached' });
}

// Runs `action`, which shows an alert, and answers it with `handle(dialog)`
// (browserDialogs.web.js turns alerts into window.confirm and window.prompt). Waits until it is
// answered: the alert may come after the action returns.
export async function withDialog(page, handle, action) {
  await Promise.all([page.waitForEvent('dialog').then(handle), action()]);
}

// The post cards on `screen` (the posts list or a post), or the one showing `text`.
export function postCards(screen, text) {
  const cards = screen.getByTestId('post-card');
  return text === undefined ? cards : cards.filter({ hasText: text });
}

async function centre(locator) {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A number constant of src/constants.js (`export const NAME = 123;`).
function readAppConstant(name) {
  const source = readFileSync(new URL('../src/constants.js', import.meta.url), 'utf8');
  const value = source.match(new RegExp(`export const ${name} = (\\d+);`))?.[1];
  if (value === undefined) throw new Error(`src/constants.js has no number ${name}; update e2e/helpers.mjs`);
  return Number(value);
}
