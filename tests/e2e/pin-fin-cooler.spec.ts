import { expect, test, type Page } from '@playwright/test';

const route = '/lab/pin-fin-cooler/';
const root = '[data-pin-fin-lab]';

async function capableDevice(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

type Snapshot = {
  initialized: number;
  disposed: number;
  active: { renderer: string; viewer: Record<string, unknown> | null }[];
  released: {
    disposed: boolean;
    listenersAborted: boolean;
    pendingFrame: boolean;
    pendingLoad: boolean;
    viewer: {
      disposed: boolean;
      scheduledFrame: boolean;
      controlsDisposed: boolean;
      rendererInfo: { geometries: number; textures: number; contextLost: boolean };
    } | null;
  }[];
};
const lifecycle = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => Reflect.get(window, 'pinFinLifecycle').snapshot());

for (const [prefix, title, ok] of [
  ['', 'Pin-fin 散热器仿真', '全部输入在关联式适用范围内'],
  ['/en', 'Pin-fin cold plate', 'All inputs lie within the correlation ranges'],
] as const) {
  test(`${prefix || 'zh'} server HTML carries the default calculation, validity table and sketches`, async ({
    request,
  }) => {
    const html = await (await request.get(prefix + route)).text();
    expect(html).toContain(title);
    expect(html).toMatch(/data-value="rth"[^>]*>0\.00773</);
    expect(html).toContain(ok);
    expect(html).toContain('data-check="zk-re"');
    expect(html).toContain(prefix ? 'Illustrative, not CFD' : '示意，非 CFD');
    expect(html).toContain(
      prefix ? 'Parametric illustrative model, simplified geometry' : '参数化示意模型，几何经简化',
    );
    expect((html.match(/class="pf-chart-mark/g) ?? []).length).toBe(25);
  });

  test(`${prefix || 'zh'} sliders, choices and sweep update results and warnings`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(prefix + route);
    const lab = page.locator(root);
    await expect(lab).toHaveAttribute('data-status', 'ok');
    const rth = lab.locator('[data-value="rth"]');
    await expect(rth).toHaveText('0.00773');
    await lab.locator('[data-choice="coolant"][data-value="glycol50"]').click();
    await expect(lab).toHaveAttribute('data-status', 'caution');
    await expect(lab.locator('[data-check="zk-band"]')).toHaveAttribute('data-status', 'caution');
    await lab.locator('[data-choice="coolant"][data-value="water"]').click();
    await expect(lab).toHaveAttribute('data-status', 'ok');

    await lab.locator('[data-param="flow"]').fill('16');
    await expect(rth).not.toHaveText('0.00773');
    await expect(lab.locator('[data-param-output="flow"]')).toHaveText('16.0');
    await expect(lab.locator('[data-chart-readout]')).toContainText('16.0');

    await lab.locator('[data-tab="footprint"]').click();
    await lab.locator('[data-param="length"]').fill('20');
    await lab.locator('[data-tab="pins"]').click();
    await lab.locator('[data-param="diameter"]').fill('3');
    await lab.locator('[data-param="pitchL"]').fill('3');
    await expect(lab).toHaveAttribute('data-status', 'out');
    await expect(lab.locator('[data-check="gg-rows"]')).toHaveAttribute('data-status', 'out');
    await expect(lab.locator('[data-explain-list="gaddis"] li[data-status="out"]')).toHaveCount(1);
    await expect(lab.locator('[data-sweep-key]')).toHaveValue('pitchL');
    await expect(lab.locator('[data-chart-marks] circle')).toHaveCount(25);

    await lab.locator('[data-sweep-key]').selectOption('height');
    await expect(lab.locator('[data-chart-table-key]')).toContainText('mm');

    await lab.locator('[data-reset-params]').click();
    await expect(rth).toHaveText('0.00773');
    await expect(lab).toHaveAttribute('data-status', 'ok');
  });
}

test('reduced motion keeps a complete static page without loading Three', async ({ page }) => {
  const heavy: string[] = [];
  page.on('request', (request) => {
    if (/three\.module\.|\/viewer\.|\.glb$/.test(new URL(request.url()).pathname))
      heavy.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(route);
  const lab = page.locator(root);
  await expect(lab.locator('[data-fallback-note]')).toBeVisible();
  await expect(lab.locator('[data-pf-preview]')).toBeVisible();
  await expect(lab.locator('[data-pf-load]')).toBeHidden();
  const animation = await lab
    .locator('[data-stream-lines] path')
    .first()
    .evaluate((path) => getComputedStyle(path).animationName);
  expect(animation).toBe('none');
  await lab.locator('[data-select-part="cover"]').click();
  await expect(lab.locator('[data-part-name]')).toHaveText('盖板与侧壁');
  await lab.locator('[data-param="flow"]').fill('4');
  await expect(lab.locator('[data-value="rth"]')).not.toHaveText('0.00773');
  await page.waitForTimeout(800);
  expect(heavy).toEqual([]);
});

test('touch devices wait for a tap before loading WebGL', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: String(testInfo.project.use.baseURL),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  try {
    await capableDevice(page);
    const heavy: string[] = [];
    page.on('request', (request) => {
      if (/three\.module\./.test(new URL(request.url()).pathname)) heavy.push(request.url());
    });
    await page.goto(route);
    const lab = page.locator(root);
    const button = lab.locator('[data-pf-load]');
    await expect(button).toBeVisible();
    await expect(lab).toHaveAttribute('data-load', 'manual');
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const canvas = (await lab.locator('[data-pf-canvas]').boundingBox())!;
    await page.touchscreen.tap(canvas.x + 12, canvas.y + 12);
    await page.waitForTimeout(1500);
    expect(heavy).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await button.tap();
    await expect(lab).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
    expect(heavy.length).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

test('desktop builds the parametric scene, selects parts and rebuilds from sliders', async ({
  page,
}) => {
  await capableDevice(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(route);
  const lab = page.locator(root);
  await expect(lab).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
  await expect(lab.locator('canvas[data-pf-webgl]')).toBeVisible();
  await expect.poll(async () => (await lifecycle(page)).active[0]?.viewer?.pinCount).toBe(240);
  await lab.locator('[data-tab="pins"]').click();
  await lab.locator('[data-param="pitchT"]').fill('3');
  await expect.poll(async () => (await lifecycle(page)).active[0]?.viewer?.pinCount).not.toBe(240);
  await lab.locator('[data-select-part="inlet-manifold"]').click();
  await expect
    .poll(async () => (await lifecycle(page)).active[0]?.viewer?.selectedId)
    .toBe('inlet-manifold');
  await lab.locator('[data-cover]').click();
  await expect(lab.locator('[data-cover]')).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(async () => (await lifecycle(page)).active[0]?.viewer?.coverVisible)
    .toBe(false);
});

test('ten Home round trips release the WebGL context each time', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await capableDevice(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  for (let index = 0; index < 10; index += 1) {
    await page.locator('a[href="/lab/"]').first().click();
    await expect(page).toHaveURL(/\/lab\/$/);
    await page.locator(`a[href="${route}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.locator(root)).toHaveAttribute('data-renderer', 'webgl', {
      timeout: 30_000,
    });
    await page.locator('.site-name').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(root)).toHaveCount(0);
    const snapshot = await lifecycle(page);
    const last = snapshot.released.at(-1)!;
    expect(snapshot.active).toHaveLength(0);
    expect(snapshot.initialized).toBe(index + 1);
    expect(snapshot.disposed).toBe(index + 1);
    expect(last.listenersAborted).toBe(true);
    expect(last.pendingFrame).toBe(false);
    expect(last.pendingLoad).toBe(false);
    expect(last.viewer?.disposed).toBe(true);
    expect(last.viewer?.scheduledFrame).toBe(false);
    expect(last.viewer?.controlsDisposed).toBe(true);
    expect(last.viewer?.rendererInfo.contextLost).toBe(true);
    expect(last.viewer?.rendererInfo.geometries).toBe(0);
    expect(last.viewer?.rendererInfo.textures).toBe(0);
  }
  expect(errors).toEqual([]);
});

for (const prefix of ['', '/en'])
  test(`${prefix}${route} loads only page fonts and inline screen styles`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fonts: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('.woff2')) fonts.push(pathname);
    });
    await page.goto(prefix + route);
    await page.evaluate(() => document.fonts.ready);
    expect(fonts.filter((url) => /noto-sans-sc-\d+-/.test(url))).toEqual([]);
    expect(
      fonts
        .filter((url) => /noto-sans-sc/.test(url))
        .every((url) => url.includes('/models/pin-fin-cooler/fonts/')),
    ).toBe(true);
    const sheets = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll(
        (links) => links.filter((link) => (link as HTMLLinkElement).media !== 'print').length,
      );
    expect(sheets).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
