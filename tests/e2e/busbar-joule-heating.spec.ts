import { expect, test, type Page } from '@playwright/test';
import type { getBusbarLifecycleSnapshot } from '../../src/components/lab/busbar-joule-heating/client';

const route = '/lab/busbar-joule-heating/';
const root = '[data-busbar-lab]';
type Snapshot = ReturnType<typeof getBusbarLifecycleSnapshot>;

async function capableDevice(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}
async function lifecycle(page: Page): Promise<Snapshot> {
  return page.evaluate(() => Reflect.get(window, 'busbarLabLifecycle').snapshot());
}
const number = async (page: Page, selector: string) =>
  Number((await page.locator(root).locator(selector).first().innerText()).replace('−', '-'));
async function setRange(page: Page, key: string, value: number) {
  await page.locator(`${root} [data-param="${key}"]`).evaluate((input: HTMLInputElement, v) => {
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

for (const prefix of ['', '/en']) {
  test(`${prefix}${route} desktop: WebGL field, exact current scaling, states and materials`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await capableDevice(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(prefix + route);
    const lab = page.locator(root);
    await expect(lab).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
    await expect(lab.locator('canvas[data-busbar-canvas="webgl"]')).toBeVisible();
    await expect(lab.locator('[data-busbar-poster]')).toBeHidden();
    await expect.poll(async () => (await lifecycle(page)).active[0]?.viewer?.mode).toBe('webgl');
    await expect(lab.locator('[data-field-status]')).toBeHidden({ timeout: 15_000 });

    // Hover the model: a conductor readout with a local value appears.
    const box = (await lab.locator('canvas[data-busbar-canvas]').boundingBox())!;
    let probed = false;
    search: for (let fy = 0.3; fy <= 0.75; fy += 0.05) {
      for (let fx = 0.25; fx <= 0.75; fx += 0.05) {
        await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
        if (await lab.locator('[data-card-probe]').isVisible()) {
          probed = true;
          break search;
        }
      }
    }
    expect(probed).toBe(true);
    await expect(lab.locator('[data-card-probe-value]')).toContainText('°C');
    await page.mouse.move(0, 0);

    const loss200 = await number(page, '[data-value="loss"]');
    const rise200 = await number(page, '[data-value="rise"]');
    const resistance200 = await number(page, '[data-value="resistance"]');
    await setRange(page, 'current', 400);
    await expect.poll(() => number(page, '[data-value="loss"]')).toBeCloseTo(loss200 * 4, 1);
    expect(await number(page, '[data-value="rise"]')).toBeCloseTo(rise200 * 4, 0);
    expect(await number(page, '[data-value="resistance"]')).toBeCloseTo(resistance200, 3);
    await expect(lab.locator('[data-warning]').first()).toBeVisible();

    await lab.locator('.busbar-segmented [data-state="sl"]').first().click();
    await expect(lab).toHaveAttribute('data-state', 'sl');
    await expect(lab.locator('svg [data-state="sl"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(lab.locator('[data-path-text="sl"]')).toBeVisible();
    await expect(lab.locator('[data-path-text="sh"]')).toBeHidden();
    await expect(lab.locator('[data-loss-share="p-layer"]')).toHaveText('0.0%');

    await lab.locator('[data-tab="material"]').click();
    const copper = await number(page, '[data-value="resistance"]');
    await lab.locator('[data-material="al-1060"]').click();
    await expect
      .poll(() => number(page, '[data-value="resistance"]'))
      .toBeCloseTo((copper * 58.0) / 35.4, 2);
    await expect(lab.locator('[data-material="al-1060"]')).toHaveAttribute('aria-pressed', 'true');
    await setRange(page, 'sigma', 40);
    await expect(lab.locator('[data-material="custom"]')).toHaveAttribute('aria-pressed', 'true');

    await lab.locator('[data-field="current"]').click();
    await expect(lab).toHaveAttribute('data-field', 'current');
    await expect(lab.locator('[data-scale-unit]')).toHaveText('A/mm²');
    await expect
      .poll(async () => (await lifecycle(page)).active[0]?.viewer?.fieldMode)
      .toBe('current');
    await lab.locator('[data-cutaway]').click();
    await lab.locator('[data-explode]').click();
    await expect.poll(async () => (await lifecycle(page)).active[0]?.viewer?.cutaway).toBe(true);
    await expect.poll(async () => (await lifecycle(page)).active[0]?.viewer?.exploded).toBe(true);

    await lab.locator('[data-select-conductor="n-layer"]').first().click();
    await expect(lab).toHaveAttribute('data-selected', 'n-layer');
    await page.mouse.move(0, 0);
    await expect(lab.locator('[data-card-name]')).toHaveText(prefix ? 'N layer' : 'N 层');
    await lab.locator('[data-reset-params]').click();
    await expect(lab).toHaveAttribute('data-state', 'sh');
    expect(errors).toEqual([]);
  });
}

test('touch devices keep the static preview until Load 3D model is tapped', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    });
    const heavy: string[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (/three\.module\.|\/viewer\.[^/]+\.js$|field-basis/.test(path)) heavy.push(path);
    });
    await page.goto(route);
    const lab = page.locator(root);
    const button = lab.locator('[data-busbar-load]');
    await expect(button).toBeVisible();
    await expect(lab).toHaveAttribute('data-load', 'manual');
    await expect(lab.locator('[data-busbar-poster]')).toBeVisible();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const stage = (await lab.locator('[data-busbar-canvas]').boundingBox())!;
    await page.touchscreen.tap(stage.x + 12, stage.y + 12);
    await page.waitForTimeout(1500);
    expect(heavy).toEqual([]);
    // Parameters work without 3D; the preview explains that it shows the default case.
    await setRange(page, 'current', 300);
    await expect(lab.locator('[data-poster-note]')).toBeVisible();
    await button.tap();
    await expect(button).toBeHidden();
    await expect(lab).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
    expect(heavy.some((path) => /three\.module\./.test(path))).toBe(true);
    // No horizontal overflow at phone width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  } finally {
    await context.close();
  }
});

test('reduced motion uses the complete 2D plan view without WebGL', async ({ page }) => {
  const contexts: string[] = [];
  page.on('request', (request) => {
    if (/three\.module\./.test(request.url())) contexts.push(request.url());
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en' + route);
  const lab = page.locator(root);
  await expect(lab).toHaveAttribute('data-renderer', 'fallback', { timeout: 15_000 });
  await expect(lab.locator('canvas[data-busbar-canvas="fallback"]')).toBeVisible();
  await expect(lab.locator('[data-fallback-note]')).toBeVisible();
  await expect(lab.locator('[data-cutaway]')).toBeHidden();
  await expect(lab.locator('[data-field-status]')).toBeHidden({ timeout: 15_000 });
  const canvas = lab.locator('canvas[data-busbar-canvas]');
  const box = (await canvas.boundingBox())!;
  // The P-layer panel is the top-left quadrant; click its plate centre.
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.27);
  await expect(lab).toHaveAttribute('data-selected', 'p-layer');
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.28);
  await expect(lab.locator('[data-card-probe]')).toBeVisible();
  await setRange(page, 'strapWidth', 6);
  await expect(lab.locator('[data-param-output="strapWidth"]')).toHaveText('6');
  expect(contexts).toEqual([]);
});

test('ten Home round trips release the WebGL context, frames and listeners', async ({ page }) => {
  test.setTimeout(180_000);
  await capableDevice(page);
  await page.addInitScript(() => {
    const contexts: WebGLRenderingContext[] = [];
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = new Proxy(getContext, {
      apply(target, receiver, args) {
        const result = Reflect.apply(target, receiver, args);
        if ((args[0] === 'webgl' || args[0] === 'webgl2') && result && !contexts.includes(result))
          contexts.push(result);
        return result;
      },
    });
    Reflect.set(window, 'busbarContexts', () => ({
      created: contexts.length,
      live: contexts.filter((context) => !context.isContextLost()).length,
    }));
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => Reflect.set(window, 'busbarRouteSession', 'same-document'));
  for (let cycle = 1; cycle <= 10; cycle += 1) {
    await page.locator('a[href="/lab/"]').first().click();
    await expect(page).toHaveURL(/\/lab\/$/);
    await page.locator(`a[href="${route}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(route + '$'));
    await expect(page.locator(root)).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
    const contexts = await page.evaluate(() => Reflect.get(window, 'busbarContexts')());
    expect(contexts.live).toBe(1);
    await page.locator('.site-name').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(async () => (await page.evaluate(() => Reflect.get(window, 'busbarContexts')())).live)
      .toBe(0);
    const snapshot = await lifecycle(page);
    expect(snapshot.active).toHaveLength(0);
    expect(snapshot.disposed).toBe(cycle);
    const released = snapshot.released.at(-1)!;
    expect(released.listenersAborted).toBe(true);
    expect(released.calculationFrame).toBe(false);
    expect(released.viewer?.disposed).toBe(true);
    expect(released.viewer?.controlsDisposed).toBe(true);
    expect(released.viewer?.scheduledFrame).toBe(false);
  }
  expect(await page.evaluate(() => Reflect.get(window, 'busbarRouteSession'))).toBe(
    'same-document',
  );
  expect(errors).toEqual([]);
});

test('lab index lists the S2 page in both locales', async ({ page }) => {
  for (const prefix of ['', '/en']) {
    await page.goto(prefix + '/lab/');
    await expect(page.locator(`a[href="${prefix}${route}"]`)).toBeVisible();
  }
});
