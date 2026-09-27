import { test, expect } from '@playwright/test';

test('the unmodified app loads without console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Your next chapter starts here.');
  await expect(page.locator('#status')).not.toHaveText('Checking…');
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({ path: 'test-results/app-preview.png', fullPage: true });
});

// Only the test browser gets these fake SDK boundaries. The shipped app has no
// fake-login mode. Server tests separately exercise actual RSA verification.
async function fakeAuth(page) {
  await page.route(/\/src\/firebase\.js(?:\?.*)?$/, (route) => route.fulfill({
    contentType: 'text/javascript', body: 'export const configured = true;',
  }));
  await page.route(/\/src\/auth\.js(?:\?.*)?$/, (route) => route.fulfill({
    contentType: 'text/javascript', body: `
      let notify;
      export function observeAuth(callback) { notify = callback; callback(null); return () => {}; }
      export async function signIn() {
        if (window.cancelNext) { window.cancelNext = false; throw {code: 'auth/popup-closed-by-user'}; }
        notify({uid: 'test-user-123', displayName: '<img src=x onerror=alert(1)>', email: 'user@example.test', getIdToken: async () => 'test-only-token'});
      }
      export async function signOut() { notify(null); }
    `,
  }));
}

test('missing configuration is explained; real Python rejects missing token', async ({ page }) => {
  await page.route(/\/src\/firebase\.js(?:\?.*)?$/, (route) => route.fulfill({ contentType: 'text/javascript', body: 'export const configured = false;' }));
  // Avoid depending on the Firebase SDK in an explicitly unconfigured session.
  await page.route(/\/src\/auth\.js(?:\?.*)?$/, (route) => route.fulfill({ contentType: 'text/javascript', body: 'export const signIn = () => {}; export const signOut = () => {}; export const observeAuth = () => {};' }));
  await page.goto('/');
  await expect(page.locator('#setup')).toBeVisible();
  await expect(page.locator('#sign-in')).toBeDisabled();
  await page.getByRole('button', { name: 'Try without a token' }).click();
  await expect(page.locator('#server-result')).toContainText('401');
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('cancellation recovers; identity is safe text; header connects browser to API', async ({ page }) => {
  await fakeAuth(page);
  await page.goto('/');
  await page.evaluate(() => { window.cancelNext = true; });
  await page.locator('#sign-in').click();
  await expect(page.locator('#auth-message')).toContainText('cancelled');
  await expect(page.locator('#sign-in')).toBeEnabled();
  await page.locator('#sign-in').click();
  await expect(page.locator('#uid')).toHaveText('test-user-123');
  await expect(page.locator('#name img')).toHaveCount(0);
  await page.route('**/api/me', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer test-only-token');
    await route.fulfill({ json: { uid: 'test-user-123', projectId: 'test-project', verified: true } });
  });
  await page.locator('#verify').click();
  await expect(page.locator('#server-result')).toContainText('200 OK');
  await page.locator('#sign-out').click();
  await expect(page.locator('#uid')).toHaveText('');
  await expect(page.locator('#email')).toHaveText('');
  await expect(page.locator('#server-result')).not.toContainText('test-user-123');
  await expect(page.locator('#verify')).toBeDisabled();
  await expect(page.locator('#applications > li')).toHaveCount(3);
  await expect(page.locator('.data-caption')).toContainText('not linked to your Google account');
});

test('tracker summaries, filtering, notes, and empty state work without sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#applications > li')).toHaveCount(3);
  await expect(page.locator('#summary dd')).toHaveText(['3', '1', '2']);
  await page.getByLabel('Search opportunities').fill('prairie');
  await expect(page.locator('#results-count')).toHaveText('1 of 3 shown');
  await expect(page.locator('#applications')).toContainText('Frontend Intern');
  await page.getByText('View notes', { exact: true }).click();
  await expect(page.locator('.notes p')).toBeVisible();
  await page.getByLabel('Status', { exact: true }).selectOption('interview');
  await expect(page.locator('#empty')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('#applications > li')).toHaveCount(3);
  await expect(page.locator('#search')).toBeFocused();
  await page.getByLabel('Status', { exact: true }).selectOption('interview');
  await expect(page.locator('#applications > li')).toHaveCount(1);
  await expect(page.locator('#applications')).toContainText('Riverbend Systems');
  await expect(page.locator('#summary dd')).toHaveText(['3', '1', '2']);
});

test('a late API response cannot restore a signed-out identity', async ({ page }) => {
  await fakeAuth(page);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/me', async (route) => {
    await gate;
    await route.fulfill({ json: { uid: 'old-user', projectId: 'test', verified: true } });
  });
  await page.goto('/');
  await page.locator('#sign-in').click();
  const pending = page.waitForRequest('**/api/me');
  await page.locator('#verify').click();
  await pending;
  await page.locator('#sign-out').click();
  const returned = page.waitForResponse('**/api/me');
  release();
  await returned;
  await expect(page.locator('#server-result')).toHaveText('No request yet. Predict what the server will say.');
});
