import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const englishRoutes = [
  '/en/',
  '/en/work/',
  '/en/work/sample-case/',
  '/en/lab/',
  '/en/lab/sample-teardown/',
  '/en/lab/sample-simulation/',
  '/en/about/',
  '/en/work/career-case-b/',
  '/en/work/career-case-c/',
];

test('English mobile header does not move page content when delayed fonts load', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const measurements = [];
  for (const route of englishRoutes) {
    let releaseFonts!: () => void;
    let fontRequests = 0;
    const fontGate = new Promise<void>((resolve) => {
      releaseFonts = resolve;
    });
    await page.route('**/*.woff2', async (request) => {
      fontRequests += 1;
      await fontGate;
      await request.continue();
    });
    const geometry = () =>
      page.evaluate(() => ({
        mainTop: document.querySelector('main')!.getBoundingClientRect().top,
        languageTop: document.querySelector('.n1-language')!.getBoundingClientRect().top,
        viewport: innerWidth,
        width: document.documentElement.scrollWidth,
      }));
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    const fallback = await geometry();
    releaseFonts();
    await page.evaluate(() => document.fonts.ready);
    const loaded = await geometry();
    expect(fontRequests, `${route} exercised a delayed font request`).toBeGreaterThan(0);
    expect(
      Math.abs(loaded.mainTop - fallback.mainTop),
      `${route} content movement`,
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(loaded.languageTop - fallback.languageTop),
      `${route} language-row movement`,
    ).toBeLessThanOrEqual(0.5);
    expect(loaded.width, `${route} horizontal overflow`).toBeLessThanOrEqual(loaded.viewport + 1);
    measurements.push({ route, fontRequests, fallback, loaded });
    await page.unroute('**/*.woff2');
  }
  const reportDirectory = new URL('../../../deliverables-v4/reports/ci/', import.meta.url);
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(
    new URL('header-font-stability.json', reportDirectory),
    `${JSON.stringify(
      {
        status: 'passed',
        viewport: { width: 390, height: 844 },
        fontDelay:
          'All WOFF2 requests held until fallback geometry is sampled after two animation frames.',
        maximumAllowedMovementPx: 0.5,
        measurements,
      },
      null,
      2,
    )}\n`,
  );
});

test('compact English mobile header retains keyboard menu operation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/');
  const toggle = page.getByTestId('menu-toggle');
  const nav = page.getByTestId('primary-nav');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(nav.locator('a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(nav).toBeHidden();
  await expect(toggle).toBeFocused();
});

test('English mobile navigation remains available when JavaScript is disabled', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/en/');
  await expect(page.getByTestId('menu-toggle')).toBeHidden();
  const links = page.getByTestId('desktop-nav').locator('a');
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) await expect(link).toBeVisible();
  await expect(page.getByTestId('language-switch')).toBeVisible();
  await context.close();
});
