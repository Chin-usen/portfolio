import { expect, test, type Page } from '@playwright/test';
import type { getAutomotiveCameraLensLifecycleSnapshot } from '../../src/components/lab/automotive-camera-lens/client';

const route = '/lab/automotive-camera-lens/';
const roots = '[data-automotive-camera-lens]';
const partIds = [
  'lens-barrel',
  'lens-1',
  'lens-2',
  'lens-3',
  'lens-4',
  'lens-5',
  'lens-6',
  'spacers',
  'aperture-stop',
  'ir-cut-filter',
  'retaining-ring',
  'o-ring',
  'lens-holder',
  'image-sensor',
  'pcb',
  'aa-adhesive',
];
const opticalIds = [
  'lens-1',
  'lens-2',
  'lens-3',
  'lens-4',
  'lens-5',
  'lens-6',
  'aperture-stop',
  'ir-cut-filter',
  'image-sensor',
];
const hiddenInOptics = [
  'lens-barrel',
  'spacers',
  'retaining-ring',
  'o-ring',
  'lens-holder',
  'pcb',
  'aa-adhesive',
];
const heavy = /\.glb(?:\?|$)|\/(?:viewer|three)[.-].*\.js/;
const viewerChunk = /\/_astro\/viewer\.[^/]+\.js$/;
type Snapshot = ReturnType<typeof getAutomotiveCameraLensLifecycleSnapshot>;

async function capableDevice(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}
async function lifecycle(page: Page): Promise<Snapshot> {
  return page.evaluate(() => Reflect.get(window, 'automotiveCameraLensLifecycle').snapshot());
}
async function viewer(page: Page) {
  const current = (await lifecycle(page)).active[0]?.viewer;
  expect(current).toBeTruthy();
  return current!;
}
async function setRange(page: Page, value: string) {
  await page.locator('[data-acl-separation]').evaluate((element, next) => {
    (element as HTMLInputElement).value = next;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
/** The three linked views agree: part tag, section target / table row and readouts. */
async function expectLinked(page: Page, partId: string) {
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-selected', partId);
  await expect(root.locator(`[data-l1-part="${partId}"]`)).toHaveAttribute('aria-pressed', 'true');
  for (const id of opticalIds)
    await expect(root.locator(`.acl-target[data-l1-select="${id}"]`)).toHaveAttribute(
      'aria-pressed',
      String(id === partId),
    );
  const name = (await root.locator('[data-l1-name]').innerText()).trim();
  await expect(root.locator('[data-acl-section-name]')).toHaveText(name);
  await expect(root.locator('[data-acl-section-role]')).toHaveText(
    (await root.locator('[data-l1-role]').innerText()).trim(),
  );
  if (/^lens-\d$/.test(partId))
    await expect(root.locator(`.acl-elements button[data-l1-select="${partId}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  else await expect(root.locator('.acl-elements button[aria-pressed="true"]')).toHaveCount(0);
}
async function observeResources(page: Page) {
  await page.addInitScript(() => {
    const contexts: WebGLRenderingContext[] = [];
    const buffers = new Set<WebGLBuffer>();
    const observedStages = new Set<Element>();
    const pendingFrames = new Set<number>();
    HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
      apply(target, receiver, args) {
        const result = Reflect.apply(target, receiver, args);
        if ((args[0] === 'webgl' || args[0] === 'webgl2') && result && !contexts.includes(result)) {
          const context = result as WebGLRenderingContext;
          contexts.push(context);
          context.createBuffer = new Proxy(context.createBuffer, {
            apply(create, owner, parameters) {
              const buffer = Reflect.apply(create, owner, parameters);
              if (buffer) buffers.add(buffer);
              return buffer;
            },
          });
          context.deleteBuffer = new Proxy(context.deleteBuffer, {
            apply(remove, owner, parameters) {
              buffers.delete(parameters[0]);
              return Reflect.apply(remove, owner, parameters);
            },
          });
        }
        return result;
      },
    });
    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends NativeResizeObserver {
      private stages = new Set<Element>();
      observe(target: Element, options?: ResizeObserverOptions) {
        super.observe(target, options);
        if (target.closest('[data-automotive-camera-lens]')) {
          this.stages.add(target);
          observedStages.add(target);
        }
      }
      unobserve(target: Element) {
        super.unobserve(target);
        this.stages.delete(target);
        observedStages.delete(target);
      }
      disconnect() {
        super.disconnect();
        for (const stage of this.stages) observedStages.delete(stage);
        this.stages.clear();
      }
    };
    const requestFrame = window.requestAnimationFrame.bind(window);
    const cancelFrame = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const frame = requestFrame((time) => {
        pendingFrames.delete(frame);
        callback(time);
      });
      pendingFrames.add(frame);
      return frame;
    };
    window.cancelAnimationFrame = (frame) => {
      pendingFrames.delete(frame);
      cancelFrame(frame);
    };
    Reflect.set(window, 'aclNativeSnapshot', () => ({
      created: contexts.length,
      live: contexts.filter((context) => !context.isContextLost()).length,
      buffers: buffers.size,
      observedStages: observedStages.size,
      pendingFrames: pendingFrames.size,
    }));
  });
}
async function nativeResources(page: Page) {
  return page.evaluate(() => Reflect.get(window, 'aclNativeSnapshot')()) as Promise<{
    created: number;
    live: number;
    buffers: number;
    observedStages: number;
    pendingFrames: number;
  }>;
}
async function noHorizontalScroll(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
}

for (const prefix of ['', '/en']) {
  test(`${prefix} camera lens links sixteen parts, two views, separation and camera keys`, async ({
    page,
  }) => {
    await capableDevice(page);
    await page.goto(prefix + route);
    const root = page.locator(roots);
    await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
    await expect(root).toHaveAttribute('data-selected', 'lens-1');
    await expect(root.locator('[data-l1-part]')).toHaveCount(16);
    await expect(root.locator('.l1-kicker')).toHaveText(
      prefix ? 'L2 · 3D teardown' : 'L2 · 3D 拆解',
    );
    const initial = await viewer(page);
    expect(initial.meshCount).toBeGreaterThanOrEqual(16);
    expect(initial.separation).toBe(1);
    expect(initial.rendererInfo.contextLost).toBe(false);
    const names = new Set<string>();
    for (const id of partIds) {
      const button = root.locator(`[data-l1-part="${id}"]`);
      await button.focus();
      await page.keyboard.press('Enter');
      await expectLinked(page, id);
      expect((await viewer(page)).selectedId).toBe(id);
      for (const field of ['name', 'role', 'features', 'material']) {
        const text = (await root.locator(`[data-l1-${field}]`).innerText()).trim();
        expect(text.length).toBeGreaterThanOrEqual(2);
        expect(text).toMatch(prefix === '' ? /[㐀-鿿]/ : /[A-Za-z]/);
      }
      names.add(await root.locator('[data-l1-name]').innerText());
    }
    expect(names.size).toBe(16);
    await root.locator('[data-l1-mode="optics"]').click();
    await expect(root).toHaveAttribute('data-mode', 'optics');
    await expect
      .poll(async () => (await viewer(page)).visiblePartIds.sort())
      .toEqual(partIds.filter((id) => !hiddenInOptics.includes(id)).sort());
    await root.locator('[data-l1-mode="whole"]').click();
    await expect
      .poll(async () => (await viewer(page)).visiblePartIds.sort())
      .toEqual([...partIds].sort());
    const separation = root.locator('[data-acl-separation]');
    await separation.focus();
    await page.keyboard.press('Home');
    await expect.poll(async () => (await viewer(page)).separation).toBe(0);
    const assembled = (await viewer(page)).partCentersMm;
    await page.keyboard.press('End');
    await expect.poll(async () => (await viewer(page)).separation).toBe(1);
    const exploded = (await viewer(page)).partCentersMm;
    for (const id of ['lens-1', 'lens-barrel', 'pcb']) {
      // Explosion moves along the optical axis only (local x).
      expect(Math.abs(exploded[id]![0]! - assembled[id]![0]!)).toBeGreaterThan(5);
      expect(exploded[id]![1]).toBeCloseTo(assembled[id]![1]!, 6);
      expect(exploded[id]![2]).toBeCloseTo(assembled[id]![2]!, 6);
    }
    await root.locator('[data-l1-reset]').click();
    const resetCamera = (await viewer(page)).cameraPosition;
    const canvas = root.locator('canvas[data-acl-webgl]');
    await canvas.focus();
    await page.keyboard.press('ArrowLeft');
    await expect
      .poll(async () =>
        Math.hypot(
          ...(await viewer(page)).cameraPosition.map((value, index) => value - resetCamera[index]!),
        ),
      )
      .toBeGreaterThan(0.005);
    await page.keyboard.press('Home');
    (await viewer(page)).cameraPosition.forEach((value, index) =>
      expect(value).toBeCloseTo(resetCamera[index]!, 6),
    );
    await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
  });

  test(`${prefix} ray section, element table and model stay three-way linked`, async ({ page }) => {
    await capableDevice(page);
    await page.goto(prefix + route);
    const root = page.locator(roots);
    await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
    await expect(root.locator('.acl-disclaimer')).toHaveText(
      prefix ? 'Illustrative, not a real optical design' : '示意，不代表真实光学设计',
    );
    await expect(root.locator('.acl-ray')).toHaveCount(9 + 3);
    for (const id of opticalIds) {
      const target = root.locator(`.acl-target[data-l1-select="${id}"]`);
      await target.focus();
      await page.keyboard.press(id === 'lens-4' ? 'Space' : 'Enter');
      await expectLinked(page, id);
      expect((await viewer(page)).selectedId).toBe(id);
    }
    await root.locator('.acl-target[data-l1-select="lens-3"] .acl-shape').first().click();
    await expectLinked(page, 'lens-3');
    await root.locator('.acl-elements button[data-l1-select="lens-5"]').click();
    await expectLinked(page, 'lens-5');
    expect((await viewer(page)).selectedId).toBe('lens-5');
    await root.locator('[data-l1-part="lens-holder"]').click();
    await expectLinked(page, 'lens-holder');
    await expect(root.locator('.acl-mech[data-l1-select="lens-holder"]').first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // A real canvas pick on a lens mesh updates the section and table.
    await root.locator('[data-l1-mode="optics"]').click();
    await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
    const canvas = root.locator('canvas[data-acl-webgl]');
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    let lensTarget: { partId: string; x: number; y: number } | undefined;
    for (const item of (await viewer(page)).pickTargets) {
      if (!/^lens-\d$/.test(item.partId) || item.partId === 'lens-5') continue;
      const point = { x: box.x + item.x, y: box.y + item.y };
      if (
        await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y)?.matches('canvas[data-acl-webgl]'),
          point,
        )
      ) {
        lensTarget = item;
        break;
      }
    }
    expect(lensTarget, 'an exposed lens surface must be pickable').toBeTruthy();
    await page.mouse.click(box.x + lensTarget!.x, box.y + lensTarget!.y);
    await expectLinked(page, lensTarget!.partId);
    expect((await viewer(page)).selectedId).toBe(lensTarget!.partId);
  });
}

test('mobile touch devices keep the poster until the visitor asks for 3D', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const heavyRequests: string[] = [];
  page.on('request', (request) => {
    if (heavy.test(request.url())) heavyRequests.push(request.url());
  });
  try {
    await capableDevice(page);
    await page.goto(String(testInfo.project.use.baseURL) + route);
    const root = page.locator(roots);
    const load = root.locator('[data-l1-load]');
    await expect(load).toBeVisible();
    await page.waitForTimeout(1200);
    expect(heavyRequests).toEqual([]);
    await expect(root.locator('canvas')).toHaveCount(0);
    // The section and table work before any WebGL request.
    await root.locator('.acl-target[data-l1-select="lens-2"]').tap();
    await expectLinked(page, 'lens-2');
    await load.tap();
    await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
    expect((await viewer(page)).selectedId).toBe('lens-2');
    await noHorizontalScroll(page);
    const bounds = await root.locator('.acl-diagram').boundingBox();
    expect(bounds!.width).toBeGreaterThan(300);
  } finally {
    await context.close();
  }
});

for (const prefix of ['', '/en']) {
  test(`${prefix} reduced-motion camera lens keeps the complete static lesson`, async ({
    page,
  }) => {
    const heavyRequests: string[] = [];
    page.on('request', (request) => {
      if (heavy.test(request.url())) heavyRequests.push(request.url());
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(prefix + route);
    const root = page.locator(roots);
    await expect(root).toHaveAttribute('data-renderer', 'fallback');
    await expect(root.locator('canvas')).toHaveCount(0);
    const image = root.locator('[data-l1-preview]');
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('srcset', /640w.*1600w/);
    await expect(root.locator('[data-acl-separation]')).toBeHidden();
    await expect(root.locator('.acl-static-note')).toBeVisible();
    for (const id of partIds) {
      await root.locator(`[data-l1-part="${id}"]`).click();
      await expectLinked(page, id);
      await expect(root.locator('[data-l1-material]')).not.toHaveText('');
    }
    for (const id of opticalIds) {
      await root.locator(`.acl-target[data-l1-select="${id}"]`).click();
      await expectLinked(page, id);
    }
    expect((await lifecycle(page)).active[0]?.viewer).toBeNull();
    expect(heavyRequests).toEqual([]);
    await noHorizontalScroll(page);
  });

  test(`${prefix} camera lens content, section and data remain without JavaScript`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    try {
      await page.goto(String(testInfo.project.use.baseURL) + prefix + route);
      const root = page.locator(roots);
      await expect(root.locator('[data-l1-preview]')).toBeVisible();
      const descriptions = root.locator('noscript section');
      await expect(descriptions).toHaveCount(16);
      for (const description of await descriptions.all())
        await expect(description.locator('dd')).toHaveCount(3);
      await expect(root.locator('.acl-diagram')).toBeVisible();
      await expect(root.locator('.acl-target')).toHaveCount(9);
      await expect(root.locator('.acl-elements tbody tr')).toHaveCount(6);
      await expect(root.locator('.acl-metrics dd').first()).toHaveText('5.83 mm');
      await noHorizontalScroll(page);
    } finally {
      await context.close();
    }
  });
}

test('a low-resource device gets the static camera lens with no heavy downloads', async ({
  page,
}) => {
  const heavyRequests: string[] = [];
  page.on('request', (request) => {
    if (heavy.test(request.url())) heavyRequests.push(request.url());
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'fallback');
  await root.locator('.acl-elements button[data-l1-select="lens-6"]').click();
  await expectLinked(page, 'lens-6');
  expect((await lifecycle(page)).active[0]?.viewer).toBeNull();
  expect(heavyRequests).toEqual([]);
});

test('navigation during a pending camera lens viewer import allocates no late context', async ({
  page,
}) => {
  await capableDevice(page);
  await observeResources(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requestedUrl = '';
  await page.route(viewerChunk, async (request) => {
    requestedUrl = request.request().url();
    await held;
    await request.continue();
  });
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => requestedUrl).not.toBe('');
    await expect.poll(async () => (await lifecycle(page)).active[0]?.pendingLoad).toBe(true);
    expect((await nativeResources(page)).created).toBe(0);
    await page.locator('.site-name').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(roots)).toHaveCount(0);
    // Home may own its own hero context; only a late lens context would add one now.
    const before = (await nativeResources(page)).created;
    release();
    await page.evaluate(async (url) => {
      await import(url);
      await Promise.resolve();
    }, requestedUrl);
    await page.waitForTimeout(300);
    expect((await nativeResources(page)).created).toBe(before);
    expect(await page.locator('canvas[data-acl-webgl]').count()).toBe(0);
    expect((await lifecycle(page)).active).toHaveLength(0);
    expect((await lifecycle(page)).released.at(-1)?.listenersAborted).toBe(true);
  } finally {
    release();
  }
});

test('camera lens context loss falls back with selection kept and resources released', async ({
  page,
}) => {
  await capableDevice(page);
  await observeResources(page);
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
  await root.locator('.acl-target[data-l1-select="aperture-stop"]').click();
  expect(
    await root.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      extension?.loseContext();
      return Boolean(extension);
    }),
  ).toBe(true);
  await expect(root).toHaveAttribute('data-renderer', 'fallback');
  await expect(root.locator('canvas')).toHaveCount(0);
  await expectLinked(page, 'aperture-stop');
  const released = await viewer(page);
  expect(released.disposed).toBe(true);
  expect(released.geometryCount).toBe(0);
  expect(released.ownedListeners).toBe(0);
  await expect.poll(async () => (await nativeResources(page)).live).toBe(0);
  expect((await nativeResources(page)).buffers).toBe(0);
  expect((await nativeResources(page)).observedStages).toBe(0);
});

test('ten Home to camera lens client-route round trips release native resources', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await capableDevice(page);
  await observeResources(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => Reflect.set(window, 'aclRouteSession', 'same-document'));
  for (let index = 0; index < 10; index++) {
    await page.locator('a[href="/lab/"]').first().click();
    await page.locator(`a[href="${route}"]`).first().click();
    await expect(page.locator(roots)).toHaveAttribute('data-renderer', 'webgl', {
      timeout: 30_000,
    });
    const native = await nativeResources(page);
    expect(native.live).toBe(1);
    expect(native.created).toBe(index + 1);
    await page.locator('.acl-target[data-l1-select="lens-4"]').click();
    await setRange(page, '40');
    await expect.poll(async () => (await viewer(page)).separation).toBe(0.4);
    const detached = await page.locator(roots).elementHandle();
    await page.locator('.site-name').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(async () => (await lifecycle(page)).active.length).toBe(0);
    await expect.poll(async () => (await nativeResources(page)).live).toBe(0);
    await expect.poll(async () => (await nativeResources(page)).pendingFrames).toBe(0);
    expect((await nativeResources(page)).buffers).toBe(0);
    expect((await nativeResources(page)).observedStages).toBe(0);
    const released = (await lifecycle(page)).released.at(-1)!;
    expect(released.listenersAborted).toBe(true);
    expect(released.viewer?.disposed).toBe(true);
    expect(released.viewer?.rendererInfo.contextLost).toBe(true);
    expect(
      await detached!.evaluate((element) => {
        const output = element.querySelector('[data-acl-section-name]')!;
        const before = output.textContent;
        element
          .querySelector<SVGElement>('.acl-target[data-l1-select="lens-1"]')!
          .dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return new Promise<boolean>((resolve) =>
          setTimeout(
            () =>
              resolve(
                output.textContent === before && element.getAttribute('data-selected') === 'lens-4',
              ),
            50,
          ),
        );
      }),
    ).toBe(true);
    await detached!.dispose();
  }
  expect(await page.evaluate(() => Reflect.get(window, 'aclRouteSession'))).toBe('same-document');
  expect(errors).toEqual([]);
});

test('camera lens reset fits the exploded and assembled train at desktop and phone widths', async ({
  page,
}) => {
  await capableDevice(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
  const canvas = root.locator('canvas[data-acl-webgl]');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const mode of ['whole', 'optics']) {
      await root.locator(`[data-l1-mode="${mode}"]`).click();
      for (const separation of [0, 100]) {
        await setRange(page, String(separation));
        await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
        const projected = (await viewer(page)).projectedBounds!;
        const canvasBox = (await canvas.boundingBox())!;
        const inset = width > 1100 ? 136 : 0;
        expect(projected.left).toBeGreaterThanOrEqual(inset - 0.5);
        expect(projected.right).toBeLessThanOrEqual(canvasBox.width - inset + 0.5);
        expect(projected.top).toBeGreaterThanOrEqual(-0.5);
        expect(projected.bottom).toBeLessThanOrEqual(canvasBox.height + 0.5);
        const occupancy = Math.max(
          (projected.right - projected.left) / (canvasBox.width - 2 * inset),
          (projected.bottom - projected.top) / canvasBox.height,
        );
        expect(occupancy, `${width} ${mode} ${separation}`).toBeGreaterThan(0.6);
      }
    }
  }
});

for (const prefix of ['', '/en']) {
  test(`${prefix} camera lens preview is stable and fonts stay page-scoped`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fonts: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('.woff2')) fonts.push(pathname);
    });
    let releaseImage!: () => void;
    const imageGate = new Promise<void>((resolve) => {
      releaseImage = resolve;
    });
    await page.route(/automotive-camera-lens-exploded(?:-640)?\.webp(?:\?|$)/, async (r) => {
      await imageGate;
      await r.continue();
    });
    try {
      await page.goto(`${prefix}${route}`, { waitUntil: 'domcontentloaded' });
      const root = page.locator(roots);
      await expect(root).toHaveAttribute('data-renderer', 'fallback');
      const preview = root.locator('[data-l1-preview]');
      const before = await preview.boundingBox();
      expect(before!.height).toBeGreaterThan(0);
      releaseImage();
      await expect
        .poll(() =>
          preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
      const after = await preview.boundingBox();
      for (const key of ['x', 'y', 'width', 'height'] as const)
        expect(after![key]).toBeCloseTo(before![key], 3);
      await page.evaluate(() => document.fonts.ready);
      expect(fonts.filter((url) => /noto-sans-sc-\d+-/.test(url))).toEqual([]);
      expect(
        fonts.every(
          (url) => url.startsWith('/models/automotive-camera-lens/fonts/') || !/noto/.test(url),
        ),
      ).toBe(true);
      await expect(root.locator('.l1-info dt')).toHaveText(
        prefix ? ['Role', 'Features', 'Common materials'] : ['作用', '特点', '常用材料'],
      );
    } finally {
      releaseImage();
    }
  });
}
