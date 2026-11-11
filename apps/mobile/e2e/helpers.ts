import { randomUUID } from 'node:crypto';
import { expect, type Dialog, type Locator, type Page } from 'playwright/test';

// Helpers for the UI flow tests. Screens under a pushed screen or a sheet, and the other tabs, stay
// in the page, so every lookup is scoped to its screen's testID.

// A name no earlier run left behind.
export function uniqueName(prefix: string) {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

// The button on `scope` named exactly `name` (its label or accessibilityLabel).
export function button(scope: Page | Locator, name: string) {
  return scope.getByRole('button', { name, exact: true });
}

// Switches the main tabs with the floating navigation bar (Library, Albums or Posts).
export async function openTab(page: Page, label: string) {
  await button(page, label).click();
}

export function assetCells(screen: Page | Locator) {
  return screen.getByTestId('asset-cell');
}

// The asset id of each grid cell on `screen` that shows its thumbnail (`<id>thumb.jpg`), in order.
export function cellAssetIds(screen: Page | Locator) {
  return assetCells(screen).evaluateAll((cells) =>
    cells.map((cell) => cell.querySelector('img')?.src.match(/([\w-]+)thumb\.jpg/)?.[1] ?? null),
  );
}

// A swipe to the next page of a horizontal pager. The web has no touch swipe a test can send over
// a photo (its gesture views take every touch), so a sideways mouse wheel scrolls the pager, and its
// scroll snap settles on the next page.
export async function swipeLeft(page: Page, locator: Locator) {
  const { x, y, width } = await centre(locator);
  await page.mouse.move(x, y);
  await page.mouse.wheel(width, 0);
}

// Drag-to-reorder: a press held until the item lifts, moved onto `to`'s slot, and let go.
export async function dragCell(page: Page, from: Locator, to: Locator) {
  const start = await centre(from);
  const end = await centre(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect.poll(() => hasLiftedItem(from), { message: 'the item lifts' }).toBe(true);
  await page.mouse.move(end.x, end.y, { steps: 20 });
  await page.mouse.up();
}

// In an open Add media menu: From Squidbox, then `count` photos of the picker from the `from`th
// (the first by default), added.
export async function pickFromSquidbox(page: Page, count: number, from = 0) {
  await page.getByRole('menuitem', { name: 'From Squidbox' }).click();
  const picker = page.getByTestId('asset-picker');
  const cells = assetCells(picker);
  for (let index = from; index < from + count; index++) await cells.nth(index).click();
  await button(picker, `Add ${count}`).click();
  await picker.waitFor({ state: 'detached' });
}

// Runs `action`, which shows an alert, and answers it with `handle(dialog)`
// (browserDialogs.web.js turns alerts into window.confirm and window.prompt). Waits until it is
// answered: the alert may come after the action returns.
export async function withDialog(page: Page, handle: (dialog: Dialog) => Promise<void>, action: () => Promise<void>) {
  await Promise.all([page.waitForEvent('dialog').then(handle), action()]);
}

// The post cards on `screen` (the posts list or a post).
export function postCards(screen: Page | Locator) {
  return screen.getByTestId('post-card');
}

// The middle of the locator's box, and its width.
async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${locator} has no box: it isn't visible`);
  const { x, y, width, height } = box;
  return { x: x + width / 2, y: y + height / 2, width };
}

// Whether the cell's screen shows a lifted item: the sortable grid draws it scaled up
// (DRAG_LIFT_SCALE). Only that screen counts, so nothing scaled up elsewhere passes for it.
function hasLiftedItem(cell: Locator) {
  return cell.evaluate((node) =>
    [...(node.closest('[data-testid$="-screen"]') ?? document).querySelectorAll('*')].some(
      (child) => new DOMMatrixReadOnly(getComputedStyle(child).transform).a > 1,
    ),
  );
}
