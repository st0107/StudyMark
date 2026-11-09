import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function login(page: Page, account = 'Alex · Student') {
  await page.goto('/login');
  await page.getByRole('button', { name: account, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shared library', exact: true })).toBeVisible();
}
async function openPdf(page: Page, id = 'java-collections', number = 1) {
  await page.goto(`/reader/${id}?page=${number}`);
  await expect(page.locator('.pdf-page')).not.toHaveClass(/is-loading/);
  await expect(page.locator('.textLayer span').first()).toBeVisible();
}
async function expectReadingLayout(page: Page) {
  await expect(page.locator('.app-sidebar')).toHaveCount(0);
  await expect(page.locator('.app-header')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveCount(0);
  const bounds = await page.locator('.reader-page').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return [rect.left, rect.top, rect.width - innerWidth, rect.height - innerHeight];
  });
  for (const offset of bounds) expect(Math.abs(offset)).toBeLessThan(1);
}
async function backToLibrary(page: Page, path = '/library') {
  await page.getByRole('link', { name: 'Back to library', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.locator('.app-header')).toBeVisible();
  await expect(page.locator('.app-sidebar')).toHaveCount(1);
}
async function selectParagraph(page: Page) {
  await page.locator('.textLayer').evaluate(layer => {
    const spans = [...layer.querySelectorAll('span')].filter(span => (span.textContent?.length ?? 0) > 40);
    const start = spans[0].firstChild!;
    const end = spans[1].firstChild!;
    const range = document.createRange();
    range.setStart(start, 0); range.setEnd(end, end.textContent!.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    layer.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
  await expect(page.getByRole('toolbar', { name: 'Selected text actions' })).toBeVisible();
}
async function geometry(page: Page) {
  return page.locator('.pdf-page').evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return [...element.querySelectorAll('.pdf-highlight')].map(highlight => {
      const rect = highlight.getBoundingClientRect();
      return [ (rect.left - bounds.left) / bounds.width, (rect.top - bounds.top) / bounds.height, rect.width / bounds.width, rect.height / bounds.height ];
    });
  });
}
async function expectTextAlignment(page: Page) {
  const drift = await page.locator('.pdf-page').evaluate(element => {
    const span = [...element.querySelectorAll('.textLayer span')].find(span => (span.textContent?.length ?? 0) > 40)!;
    // Highlights follow selected glyph bounds. The span's line box has a different
    // ascent at larger font sizes, so measure the same text range used to select it.
    const range = document.createRange();
    range.selectNodeContents(span);
    const text = range.getBoundingClientRect();
    const highlight = element.querySelector('.pdf-highlight')!.getBoundingClientRect();
    return Math.max(Math.abs(text.left - highlight.left), Math.abs(text.top - highlight.top));
  });
  expect(drift).toBeLessThan(2);
}
test('multiline highlight, note CRUD, zoom/resize/reload persistence, and account isolation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page);
  await page.screenshot({ path: '.qa/library-desktop.png', fullPage: true });
  await openPdf(page);
  await expectReadingLayout(page);
  await selectParagraph(page);
  await page.getByRole('button', { name: 'Highlight yellow', exact: true }).click();
  await expect(page.locator('.pdf-highlight').first()).toBeVisible();
  const before = await geometry(page);
  expect(before.length).toBeGreaterThanOrEqual(2);
  const card = page.locator('.annotation-card').filter({ has: page.getByText('Highlight', { exact: true }) });
  await card.getByRole('button', { name: 'Edit annotation' }).click();
  await card.getByRole('textbox', { name: 'Your note' }).fill('Review these collection tradeoffs.');
  await card.getByRole('button', { name: 'Save note' }).click();
  await expect(card.getByText('Review these collection tradeoffs.')).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.pdf-page')).not.toHaveClass(/is-loading/);
  const zoomed = await geometry(page);
  before.forEach((rect, i) => rect.forEach((value, j) => expect(zoomed[i][j]).toBeCloseTo(value, 3)));
  await expectTextAlignment(page);
  await page.getByRole('button', { name: '150%', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect(page.getByRole('button', { name: '75%', exact: true })).toBeVisible();
  await expect(page.locator('.pdf-page')).not.toHaveClass(/is-loading/);
  await expectTextAlignment(page);
  await page.getByRole('button', { name: '75%', exact: true }).click();
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(page.locator('.pdf-page')).not.toHaveClass(/is-loading/);
  const resized = await geometry(page);
  before.forEach((rect, i) => rect.forEach((value, j) => expect(resized[i][j]).toBeCloseTo(value, 3)));
  await expectTextAlignment(page);
  await page.screenshot({ path: '.qa/reader-desktop.png', fullPage: true });
  await page.reload();
  await expect(page.locator('.pdf-highlight').first()).toBeVisible();
  await expect(page.getByText('Review these collection tradeoffs.')).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('2');
  await card.getByRole('button', { name: 'Page 1', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('1');
  await expect(page.locator('.pdf-highlight.is-active').first()).toBeVisible();
  await backToLibrary(page);
  await expect(page.locator('.app-sidebar')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sam · Student', exact: true }).click();
  await openPdf(page);
  await expect(page.locator('.pdf-highlight')).toHaveCount(0);
  await expect(page.locator('.annotation-card')).toHaveCount(0);
  await page.goto('/my-pdfs');
  await expect(page.getByText('Java Revision Notes', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Alex · Student', exact: true }).click();
  await openPdf(page);
  await expect(page.locator('.pdf-highlight').first()).toBeVisible();
  await card.getByRole('button', { name: 'Delete annotation' }).click();
  await card.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.pdf-highlight')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('upload, rename, note failure/retry, delete and mobile navigation', async ({ page }) => {
  await login(page);
  await page.goto('/my-pdfs');
  await page.getByRole('button', { name: 'Upload PDF', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Choose PDF file').setInputFiles('public/samples/rotated-regression.pdf');
  await dialog.getByLabel('Document title').fill('Rotation practice');
  await dialog.getByRole('button', { name: 'Upload PDF', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Rotation practice', exact: true }).click();
  await expect(page.locator('.textLayer span').first()).toBeVisible();
  await selectParagraph(page);
  await page.getByRole('button', { name: 'Highlight blue', exact: true }).click();
  await expect(page.locator('.pdf-highlight').first()).toBeVisible();
  await page.reload();
  await expect(page.locator('.pdf-highlight').first()).toBeVisible();
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByRole('textbox', { name: 'Your note' }).fill('Remember the rotated example.');
  await page.getByRole('button', { name: 'Close notes sidebar', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle notes sidebar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Your note' })).toHaveValue('Remember the rotated example.');
  await page.evaluate(async () => { const path = '/src/shared/api/index.ts'; const api = await import(/* @vite-ignore */ path); api.failNextMockMutation(); });
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Your draft is kept');
  await expect(page.locator('.reader-save-state')).toContainText('Save failed');
  await expect(page.getByRole('textbox', { name: 'Your note' })).toHaveValue('Remember the rotated example.');
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByText('Remember the rotated example.', { exact: true })).toBeVisible();
  await backToLibrary(page, '/my-pdfs');
  const doc = page.locator('.document-card').filter({ hasText: 'Rotation practice' });
  await doc.locator('summary').click();
  await doc.getByRole('button', { name: 'Rename' }).click();
  await page.getByRole('dialog').getByLabel('Document title').fill('Rotated fixture');
  await page.getByRole('dialog').getByRole('button', { name: /Save/ }).click();
  await expect(page.getByRole('link', { name: 'Rotated fixture', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.qa/library-mobile.png', fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'My highlights', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My highlights', exact: true })).toBeVisible();
  await page.goto('/my-pdfs');
  const renamed = page.locator('.document-card').filter({ hasText: 'Rotated fixture' });
  await renamed.locator('summary').click();
  await renamed.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Delete/ }).click();
  await expect(page.getByRole('link', { name: 'Rotated fixture', exact: true })).toHaveCount(0);
});

test('admin publication and student route restrictions', async ({ page }) => {
  await login(page, 'Administrator');
  await page.goto('/admin');
  const row = page.getByRole('row').filter({ hasText: 'Java Collections' });
  await row.getByRole('button', { name: 'Unpublish' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Unpublish/ }).click();
  await expect(row.getByText('Draft', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Alex · Student', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Java Collections', exact: true })).toHaveCount(0);
  await page.goto('/reader/java-collections');
  await expect(page.getByRole('heading', { name: 'This document is unavailable' })).toBeVisible();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/library$/);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Administrator', exact: true }).click();
  await page.getByRole('link', { name: 'Manage materials', exact: true }).click();
  await row.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(row.getByText('Published', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Alex · Student', exact: true }).click();
  await openPdf(page);
  await expect(page.locator('.annotation-card')).toHaveCount(1);
});

test('last-read page survives cached library navigation and reload', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Java Collections', exact: true }).click();
  await expect(page.locator('.textLayer span').first()).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Page number' }).fill('7');
  await page.getByRole('spinbutton', { name: 'Page number' }).press('Enter');
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/shared/api/index.ts';
    const { api } = await import(/* @vite-ignore */ path);
    return (await api.getDocument('java-collections')).lastPage;
  })).toBe(7);
  await backToLibrary(page);
  await expect(page.getByRole('progressbar', { name: 'Java Collections reading progress' })).toHaveAttribute('value', '35');
  await page.getByRole('link', { name: 'Java Collections', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('7');
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('7');
});

test('page notes can be searched, exported, edited and deleted from My highlights', async ({ page }) => {
  await login(page);
  await openPdf(page, 'java-collections', 2);
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByRole('textbox', { name: 'Your note' }).fill('Review iterator behavior before practice.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByText('Review iterator behavior before practice.', { exact: true })).toBeVisible();
  await backToLibrary(page);
  await page.getByRole('link', { name: 'My highlights', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search highlights' }).fill('iterator behavior');
  await page.getByRole('combobox', { name: 'Annotation type' }).selectOption('notes');
  await expect(page.locator('.annotation-card')).toHaveCount(1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export notes', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('studymark-notes.md');
  const markdown = await readFile((await download.path())!, 'utf8');
  expect(markdown).toContain('## Java Collections');
  expect(markdown).toContain('### Page 2');
  expect(markdown).toContain('Review iterator behavior before practice.');
  expect(markdown.match(/### Page /g)).toHaveLength(1);
  const card = page.locator('.annotation-card');
  await card.getByRole('button', { name: 'Edit annotation' }).click();
  await card.getByRole('textbox', { name: 'Your note' }).fill('Review iterator behavior and fail-fast collections.');
  await card.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(card.getByText('Review iterator behavior and fail-fast collections.', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Page 2', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Page number' })).toHaveValue('2');
  await expect(page.locator('.annotation-card.is-active')).toContainText('Review iterator behavior and fail-fast collections.');
  await backToLibrary(page);
  await page.getByRole('link', { name: 'My highlights', exact: true }).click();
  const saved = page.locator('.annotation-card').filter({ hasText: 'Review iterator behavior and fail-fast collections.' });
  await saved.getByRole('button', { name: 'Delete annotation' }).click();
  await saved.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(saved).toHaveCount(0);
});

test('admin uploads a shared draft and publishes it for both student accounts', async ({ page }) => {
  await login(page, 'Administrator');
  await page.getByRole('link', { name: 'Manage materials', exact: true }).click();
  await page.getByRole('button', { name: 'Add material', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Choose PDF file').setInputFiles('public/samples/rotated-regression.pdf');
  await dialog.getByLabel('Document title').fill('Shared geometry practice');
  await dialog.getByLabel('Subject', { exact: true }).fill('Computer Science');
  await dialog.getByRole('button', { name: 'Save as draft', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'Shared geometry practice' });
  await expect(row.getByText('Draft', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Shared library', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shared geometry practice', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Manage materials', exact: true }).click();
  await row.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(row.getByText('Published', { exact: true })).toBeVisible();
  for (const account of ['Alex · Student', 'Sam · Student']) {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('button', { name: account, exact: true }).click();
    await page.getByRole('link', { name: 'Shared library', exact: true }).click();
    await page.getByRole('link', { name: 'Shared geometry practice', exact: true }).click();
    await expect(page.locator('.textLayer span').first()).toBeVisible();
    await expect(page.locator('.annotation-card')).toHaveCount(0);
    await backToLibrary(page);
  }
});

test('registration, form errors, mouse selection, and mobile reader', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Taylor Student');
  await page.getByLabel('Email address').fill('taylor@example.test');
  await page.getByLabel('Password', { exact: true }).fill('DemoPassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  await openPdf(page);
  const bounds = await page.locator('.textLayer span').filter({ hasText: 'A collection groups' }).boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + 1, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width - 2, bounds!.y + bounds!.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('toolbar', { name: 'Selected text actions' })).toBeVisible();
  await page.getByRole('button', { name: 'Highlight green', exact: true }).click();
  await expect(page.locator('.pdf-highlight').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Close notes sidebar', exact: true }).click();
  await expect(page.locator('.pdf-page')).not.toHaveClass(/is-loading/);
  await expectReadingLayout(page);
  await page.screenshot({ path: '.qa/reader-mobile.png', fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await backToLibrary(page);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email address').fill('taylor@example.test');
  await page.getByLabel('Password', { exact: true }).fill('WrongPassword');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('email or password is incorrect');
  await page.screenshot({ path: '.qa/auth-mobile.png', fullPage: true, animations: 'disabled' });
});
