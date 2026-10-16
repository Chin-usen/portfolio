import { expect, test } from '@playwright/test';

const pages = [
  '/',
  '/work/',
  '/work/sample-case/',
  '/work/career-case-b/',
  '/work/career-case-c/',
  '/lab/',
  '/lab/sample-teardown/',
  '/lab/sample-simulation/',
  '/lab/chip-junction-temperature/',
  '/about/',
  '/contact/',
];
const localize = (route: string, english: boolean) => (english ? `/en${route}` : route);
const routes = [false, true].flatMap((english) =>
  [...pages, '/404/'].map((route) => ({
    route: localize(route, english),
    english,
    errorPage: route === '/404/',
  })),
);

for (const { route, english, errorPage } of routes) {
  test(`${route} serves the expected document and same-page translation`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(errorPage ? 404 : 200);
    const settledRoute = route.replace('/contact/', '/about/');
    if (route.endsWith('/contact/')) {
      await expect(page).toHaveURL(new RegExp(`${settledRoute}#contact$`));
    }
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', english ? /^en/ : /^zh/);
    await expect(page).toHaveTitle(/\S+/);
    const otherRoute = english ? settledRoute.slice(3) : `/en${settledRoute}`;
    const switcher = page.getByTestId('language-switch');
    await expect(switcher).toHaveAttribute('href', otherRoute);
    await switcher.click();
    await expect(page).toHaveURL(
      new RegExp(`${otherRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    );
    await expect(page.locator('html')).toHaveAttribute('lang', english ? /^zh/ : /^en/);
  });
}

test('unknown URLs are genuine localized 404 responses, not SPA fallbacks', async ({ page }) => {
  for (const route of ['/this-route-does-not-exist/', '/en/this-route-does-not-exist/']) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(404);
    await expect(page.locator('h1')).toContainText(/404|not found|未找到|不存在/i);
    await expect(page.locator('html')).toHaveAttribute(
      'lang',
      route.startsWith('/en/') ? /^en/ : /^zh/,
    );
  }
});

test('all routes fit a 390px mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const { route } of routes) {
    await page.goto(route);
    if (route.endsWith('/contact/')) {
      await expect(page).toHaveURL(new RegExp(`${route.replace('/contact/', '/about/')}#contact$`));
    }
    await page.evaluate(() => document.fonts.ready);
    const size = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(size.document, `${route} document overflow`).toBeLessThanOrEqual(size.viewport + 1);
    expect(size.body, `${route} body overflow`).toBeLessThanOrEqual(size.viewport + 1);
  }
});

test('mobile menu works with keyboard and returns focus when dismissed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.getByTestId('menu-toggle');
  const nav = page.getByTestId('primary-nav');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(nav).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(nav.locator('a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('email is assembled only after a visitor asks to reveal it', async ({ page, request }) => {
  const response = await page.goto('/about/');
  const html = await response!.text();
  const rawEmail = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/i;
  expect(html).not.toMatch(rawEmail);
  expect(html).not.toMatch(/<a\b[^>]*\bhref\s*=\s*["']mailto:/i);
  const address = page.getByTestId('email-address');
  await expect(address).not.toBeVisible();
  await page.getByTestId('email-reveal').click();
  await expect(address).toBeVisible();
  const href = await address.getAttribute('href');
  expect(href).toMatch(/^mailto:.+@.+\..+/);
  const revealedAddress = href!.slice('mailto:'.length);
  expect(html.toLowerCase()).not.toContain(revealedAddress.toLowerCase());
  for (const script of await page
    .locator('script[src]')
    .evaluateAll((elements) =>
      elements
        .map((element) => element.getAttribute('src'))
        .filter((src): src is string => src !== null),
    )) {
    const scriptResponse = await request.get(script);
    expect(scriptResponse.ok()).toBe(true);
    expect((await scriptResponse.text()).toLowerCase()).not.toContain(
      revealedAddress.toLowerCase(),
    );
  }
});

test('metadata is localized and scripts stay on the same origin', async ({ page }) => {
  for (const { route, english } of routes) {
    await page.goto(route);
    if (route.endsWith('/contact/')) {
      await expect(page).toHaveURL(new RegExp(`${route.replace('/contact/', '/about/')}#contact$`));
    }
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /^https:\/\/example\.com\//,
    );
    await expect(page.locator('link[hreflang="zh-CN"]')).toHaveCount(1);
    await expect(page.locator('link[hreflang="en"]')).toHaveCount(1);
    await expect(page.locator('link[hreflang="x-default"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
      'content',
      english ? 'en_US' : 'zh_CN',
    );
    const scripts = await page
      .locator('script[src]')
      .evaluateAll((elements) => elements.map((element) => (element as HTMLScriptElement).src));
    expect(scripts.every((src) => new URL(src).origin === 'http://127.0.0.1:4322')).toBe(true);
  }
});

test('on-demand dependency demos run and reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/lab/sample-simulation/');
  const panel = page.locator('lazy-demos');
  const labels = JSON.parse((await panel.getAttribute('data-labels'))!);
  for (const kind of ['three', 'animation', 'lenis']) {
    await page.locator(`[data-demo="${kind}"]`).click();
    await expect(page.getByTestId('demo-status')).toHaveText(
      kind === 'three' ? new RegExp(`${labels.complete}|${labels.unsupported}`) : labels.complete,
    );
    if ((await page.getByTestId('demo-status').innerText()) !== labels.unsupported)
      await expect(page.getByTestId('demo-stage')).toBeVisible();
    await page.locator('[data-demo-reset]').click();
    await expect(page.getByTestId('demo-stage')).toBeEmpty();
  }
  expect(errors).toEqual([]);
});
