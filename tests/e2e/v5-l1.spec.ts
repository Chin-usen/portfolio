import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BridgeViewerDiagnostics } from '../../src/components/lab/half-bridge/types';

const route = '/lab/half-bridge-module/';
const roots = '[data-half-bridge]';
const modelUrl = '**/models/l1/*.glb';

async function capableDevice(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

async function lifecycle(page: Page) {
  return page.evaluate(() => Reflect.get(window, 'halfBridgeLifecycle').snapshot());
}

function expectSourceCollectorContact(viewer: BridgeViewerDiagnostics) {
  expect(viewer.sourceCollectorContacts.map((contact) => contact.clipName).sort()).toEqual([
    'source-clip-sl-1',
    'source-clip-sl-2',
    'source-clip-sl-3',
    'source-clip-sl-4',
  ]);
  for (const contact of viewer.sourceCollectorContacts) {
    expect(
      contact.gapMm,
      `${contact.clipName} must meet the actual collector surface`,
    ).not.toBeNull();
    // One micrometre is well below the former 0.1/1.5/7.5 mm translations.
    expect(Math.abs(contact.gapMm!)).toBeLessThan(0.001);
  }
  const bounds = viewer.sourceCollectorBounds;
  expect(bounds).not.toBeNull();
  expect(bounds!.nPlateTopYmm).not.toBeNull();
  expect(bounds!.topYmm).toBeCloseTo(bounds!.nPlateTopYmm!, 6);
  return bounds!;
}

function inductanceNh(d: number, w: number, l: number) {
  return ((4 * Math.PI * 1e-7 * (l / 1000) * (d / 1000)) / (w / 1000)) * 1e9;
}

async function expectInductance(page: Page, d: number, w: number, l: number) {
  const result = Number.parseFloat(await page.locator('[data-l1-inductance]').innerText());
  expect(result).toBeCloseTo(inductanceNh(d, w, l), 2);
}

for (const prefix of ['', '/en']) {
  test(
    prefix + ' L1 has three usable modes, linked part controls and real model resources',
    async ({ page }) => {
      await capableDevice(page);
      await page.goto(prefix + route);
      const root = page.locator(roots);
      await expect(root).toHaveAttribute('data-selected', 'busbar');
      await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
      await expect(root.locator('canvas')).toBeVisible();
      const initialPartName = await root.locator('[data-l1-name]').innerText();
      for (const mode of ['assembled', 'exploded', 'commutation']) {
        const button = page.locator('[data-l1-mode="' + mode + '"]');
        await button.click();
        await expect(root).toHaveAttribute('data-mode', mode);
        await expect(button).toHaveAttribute('aria-pressed', 'true');
      }
      const amb = root.locator('button[data-l1-part="amb"]').first();
      await amb.click();
      await expect(root).toHaveAttribute('data-selected', 'amb');
      await expect(amb).toHaveAttribute('aria-pressed', 'true');
      expect((await lifecycle(page)).active[0].viewer.selectedId).toBe('amb');
      await expect(root.locator('[data-l1-name]')).not.toHaveText(initialPartName);
      const ambPartName = await root.locator('[data-l1-name]').innerText();
      const mosfet = root.locator('[data-l1-topology] [data-l1-select="mosfet"]').first();
      await mosfet.focus();
      await page.keyboard.press('Enter');
      await expect(root).toHaveAttribute('data-selected', 'mosfet');
      await expect(root.locator('button[data-l1-part="mosfet"]').first()).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(mosfet).toHaveAttribute('aria-pressed', 'true');
      expect((await lifecycle(page)).active[0].viewer.selectedId).toBe('mosfet');
      await expect(root.locator('[data-l1-name]')).not.toHaveText(ambPartName);
      expect(await page.locator('main').innerText()).not.toMatch(/INPC|\uFFFD|\?{2,}/);
      const active = (await lifecycle(page)).active[0];
      expect(active.viewer.geometryCount).toBeGreaterThan(0);
      expect(active.viewer.meshCount).toBeGreaterThanOrEqual(10);
      expect(active.viewer.rendererInfo.contextLost).toBe(false);

      // A real canvas pointer event exercises the raycaster, not a selection hook.
      await page.locator('[data-l1-mode="exploded"]').click();
      await expect
        .poll(async () => (await lifecycle(page)).active[0].viewer.explodeProgress)
        .toBe(1);
      await root.locator('canvas').scrollIntoViewIfNeeded();
      const pickTarget = (await lifecycle(page)).active[0].viewer.pickTargets.find(
        (target: { partId: string }) => target.partId === 'busbar',
      );
      expect(pickTarget, 'an exposed busbar surface must be pickable').toBeTruthy();
      const canvasBox = await root.locator('canvas').boundingBox();
      expect(canvasBox).not.toBeNull();
      const point = { x: canvasBox!.x + pickTarget.x, y: canvasBox!.y + pickTarget.y };
      expect(
        await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y)?.matches('canvas[data-l1-webgl]'),
          point,
        ),
      ).toBe(true);
      await root.locator('canvas').evaluate((canvas) => {
        canvas.addEventListener(
          'pointerdown',
          (event) => Reflect.set(window, 'l1CanvasReceivedPointer', event.target === canvas),
          { once: true },
        );
      });
      await page.mouse.click(point.x, point.y);
      expect(await page.evaluate(() => Reflect.get(window, 'l1CanvasReceivedPointer'))).toBe(true);
      await expect(root).toHaveAttribute('data-selected', 'busbar');
      expect((await lifecycle(page)).active[0].viewer.selectedId).toBe('busbar');
      await expect(root.locator('[data-l1-name]')).toHaveText(initialPartName);
      await expect(root.locator('button[data-l1-part="busbar"]').first()).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(
        root.locator('[data-l1-topology] [data-l1-select="busbar"]').first(),
      ).toHaveAttribute('aria-pressed', 'true');

      // Inspect transformed model meshes in assembled mode, rather than echoing d.
      await page.locator('[data-l1-mode="assembled"]').click();
      await expect
        .poll(async () => (await lifecycle(page)).active[0].viewer.explodeProgress)
        .toBe(0);
      await expect
        .poll(async () => (await lifecycle(page)).active[0].viewer.scheduledFrame)
        .toBe(false);
      const defaultViewer = (await lifecycle(page)).active[0].viewer;
      expect(defaultViewer.gapMm).toBe(0.5);
      const defaultCollector = expectSourceCollectorContact(defaultViewer);
      const d = page.locator('[data-l1-param="d"]');
      await d.focus();
      await page.keyboard.press('Home');
      await expect.poll(async () => (await lifecycle(page)).active[0].viewer.gapMm).toBe(0.1);
      await expect
        .poll(async () => (await lifecycle(page)).active[0].viewer.scheduledFrame)
        .toBe(false);
      const minimumViewer = (await lifecycle(page)).active[0].viewer;
      const minimum = minimumViewer.busbarPositions;
      const minimumCollector = expectSourceCollectorContact(minimumViewer);
      expect(minimumCollector.bottomYmm).toBeCloseTo(defaultCollector.bottomYmm, 6);
      expect(defaultCollector.topYmm - minimumCollector.topYmm).toBeCloseTo((0.5 - 0.1) * 4, 6);
      expect(minimum.pY).not.toBeNull();
      expect(minimum.nY).not.toBeNull();
      expect(minimum.nY - minimum.pY).toBeGreaterThan(0);
      await page.keyboard.press('End');
      await expect.poll(async () => (await lifecycle(page)).active[0].viewer.gapMm).toBe(2);
      await expect
        .poll(async () => (await lifecycle(page)).active[0].viewer.scheduledFrame)
        .toBe(false);
      const maximumViewer = (await lifecycle(page)).active[0].viewer;
      const maximum = maximumViewer.busbarPositions;
      const maximumCollector = expectSourceCollectorContact(maximumViewer);
      expect(maximumCollector.bottomYmm).toBeCloseTo(defaultCollector.bottomYmm, 6);
      expect(maximumCollector.topYmm - minimumCollector.topYmm).toBeCloseTo((2 - 0.1) * 4, 6);
      expect(maximum.nY - maximum.pY - (minimum.nY - minimum.pY)).toBeCloseTo(
        ((2 - 0.1) * 4) / 1000,
        6,
      );
      await expectInductance(page, 2, 40, 100);

      // Exercise actual OrbitControls input and the reset action.
      const canvas = root.locator('canvas');
      await canvas.scrollIntoViewIfNeeded();
      await root.locator('[data-l1-reset]').click();
      const resetCamera = (await lifecycle(page)).active[0].viewer.cameraPosition;
      const resetRadius = (await lifecycle(page)).active[0].viewer.cameraRadius;
      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 20, { steps: 8 });
      await page.mouse.up();
      await expect
        .poll(async () => {
          const current = (await lifecycle(page)).active[0].viewer.cameraPosition;
          return Math.hypot(
            ...current.map((value: number, index: number) => value - resetCamera[index]),
          );
        })
        .toBeGreaterThan(0.005);
      await page.mouse.wheel(0, -160);
      await expect
        .poll(async () =>
          Math.abs((await lifecycle(page)).active[0].viewer.cameraRadius - resetRadius),
        )
        .toBeGreaterThan(0.001);
      await root.locator('[data-l1-reset]').click();
      const restored = (await lifecycle(page)).active[0].viewer.cameraPosition;
      restored.forEach((value: number, index: number) =>
        expect(value).toBeCloseTo(resetCamera[index], 6),
      );

      const transitionMs = await page.evaluate(async () => {
        const start = performance.now();
        document.querySelector<HTMLButtonElement>('[data-l1-mode="exploded"]')!.click();
        return new Promise<number>((resolve) => {
          const sample = () => {
            const progress = Reflect.get(window, 'halfBridgeLifecycle').snapshot().active[0].viewer
              .explodeProgress;
            if (progress === 1 || performance.now() - start > 1000)
              resolve(performance.now() - start);
            else requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
      });
      expect(transitionMs).toBeLessThanOrEqual(600);
      await root.locator('[data-l1-mode="commutation"]').click();
      await expect
        .poll(async () => (await lifecycle(page)).active[0].viewer.currentPathAnchors.length)
        .toBe(7);
    },
  );

  test(
    prefix + ' L1 sliders use SI units and update default and boundary values',
    async ({ page }) => {
      await page.goto(prefix + route + '?renderer=2d');
      await expect(page.locator(roots)).toHaveAttribute('data-renderer', 'fallback');
      await expectInductance(page, 0.5, 40, 100);
      const d = page.locator('[data-l1-param="d"]');
      const w = page.locator('[data-l1-param="w"]');
      const l = page.locator('[data-l1-param="l"]');
      await d.focus();
      await page.keyboard.press('Home');
      await expect(d).toHaveValue('0.1');
      await expectInductance(page, 0.1, 40, 100);
      await page.keyboard.press('End');
      await expect(d).toHaveValue('2');
      await expectInductance(page, 2, 40, 100);
      await w.focus();
      await page.keyboard.press('Home');
      await expect(w).toHaveValue('10');
      await expectInductance(page, 2, 10, 100);
      await l.focus();
      await page.keyboard.press('End');
      await expect(l).toHaveValue('140');
      await expectInductance(page, 2, 10, 140);
      await w.focus();
      await page.keyboard.press('End');
      await expect(w).toHaveValue('60');
      await l.focus();
      await page.keyboard.press('Home');
      await expect(l).toHaveValue('40');
      await d.focus();
      await page.keyboard.press('Home');
      await expectInductance(page, 0.1, 60, 40);
    },
  );

  test(
    prefix + ' reduced-motion L1 keeps the complete lesson without loading GLB',
    async ({ page }) => {
      const modelRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/models/l1/') && request.url().endsWith('.glb'))
          modelRequests.push(request.url());
      });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(prefix + route);
      const root = page.locator(roots);
      await expect(root).toHaveAttribute('data-renderer', 'fallback');
      await expect(root.locator('canvas')).toHaveCount(0);
      const staticImage = root.locator('img[src*="half-bridge"]');
      await expect(staticImage).toBeVisible();
      expect(
        await staticImage.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      ).toBe(true);
      await expect(root.locator('[data-l1-topology]')).toBeVisible();
      expect(await root.locator('button[data-l1-part]').count()).toBe(10);
      for (const mode of ['assembled', 'commutation', 'exploded']) {
        await root.locator('[data-l1-mode="' + mode + '"]').click();
        await expect(root).toHaveAttribute('data-mode', mode);
      }
      await root.locator('button[data-l1-part="housing"]').first().click();
      await expect(root).toHaveAttribute('data-selected', 'housing');
      await root.locator('[data-l1-param="d"]').focus();
      await page.keyboard.press('End');
      await expectInductance(page, 2, 40, 100);
      expect(modelRequests).toEqual([]);
      const geometry = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
    },
  );
}

test('a low-resource device gets functional L1 without attempting a WebGL model', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
  });
  let requests = 0;
  await page.route(modelUrl, async (request) => {
    requests += 1;
    await request.continue();
  });
  await page.goto(route);
  await expect(page.locator(roots)).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.locator(roots + ' canvas')).toHaveCount(0);
  await page.locator('button[data-l1-part="gate-wire"]').first().click();
  await expect(page.locator(roots)).toHaveAttribute('data-selected', 'gate-wire');
  await expectInductance(page, 0.5, 40, 100);
  expect(requests).toBe(0);
});

test('failed model download preserves L1 controls and a readable static view', async ({ page }) => {
  await capableDevice(page);
  let attempts = 0;
  await page.route(modelUrl, async (request) => {
    attempts += 1;
    await request.abort('failed');
  });
  await page.goto(route);
  await expect.poll(() => attempts).toBeGreaterThan(0);
  await expect(page.locator(roots)).toHaveAttribute('data-renderer', 'fallback');
  const fallbackImage = page.locator(roots + ' img[src*="half-bridge"]');
  await expect(fallbackImage).toBeVisible();
  expect(
    await fallbackImage.evaluate(
      (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
    ),
  ).toBe(true);
  await expect(page.locator(roots + ' canvas')).toHaveCount(0);
  const failedViewer = (await lifecycle(page)).active[0].viewer;
  if (failedViewer) expect(failedViewer.rendererInfo.contextLost).toBe(true);
  await page.locator('button[data-l1-part="amb"]').first().click();
  await expect(page.locator(roots)).toHaveAttribute('data-selected', 'amb');
  await expectInductance(page, 0.5, 40, 100);
});

test('ten Home to L1 client-route round trips release each actual WebGL context', async ({
  page,
}) => {
  test.setTimeout(120_000);
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
    Reflect.set(window, 'l1NativeContextSnapshot', () => ({
      created: contexts.length,
      live: contexts.filter((context) => !context.isContextLost()).length,
    }));
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => Reflect.set(window, 'l1RouteSession', 'same-document'));
  const cycles = [];
  for (let index = 0; index < 10; index += 1) {
    await page.locator('a[href="/lab/"]').first().click();
    await page
      .locator('a[href="' + route + '"]')
      .first()
      .click();
    await expect(page.locator(roots)).toHaveAttribute('data-renderer', 'webgl', {
      timeout: 30_000,
    });
    const active = await lifecycle(page);
    const nativeActive = await page.evaluate(() =>
      Reflect.get(window, 'l1NativeContextSnapshot')(),
    );
    expect(active.active).toHaveLength(1);
    expect(nativeActive.live).toBe(1);
    expect(nativeActive.created).toBe(index + 1);
    const detached = await page.locator('[data-l1-mode="commutation"]').elementHandle();
    await page.locator('[data-l1-mode="commutation"]').click();
    await page.locator('.site-name').first().click();
    await expect(page.locator(roots)).toHaveCount(0);
    await expect.poll(async () => (await lifecycle(page)).active.length).toBe(0);
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => Reflect.get(window, 'l1NativeContextSnapshot')())).live,
      )
      .toBe(0);
    const released = (await lifecycle(page)).released.at(-1);
    expect(released.disposed).toBe(true);
    expect(released.listenersAborted).toBe(true);
    expect(released.observersConnected).toBe(false);
    expect(released.pendingLoad).toBe(false);
    expect(released.viewer.disposed).toBe(true);
    expect(released.viewer.scheduledFrame).toBe(false);
    expect(released.viewer.ownedListeners).toBe(0);
    expect(released.viewer.controlsDisposed).toBe(true);
    expect(released.viewer.geometryCount).toBe(0);
    expect(released.viewer.rendererInfo.contextLost).toBe(true);
    await detached!.evaluate((button) => (button as HTMLButtonElement).click());
    expect((await lifecycle(page)).active).toHaveLength(0);
    expect(await page.evaluate(() => Reflect.get(window, 'l1RouteSession'))).toBe('same-document');
    await detached!.dispose();
    cycles.push({ cycle: index + 1, active, nativeActive, released });
  }
  expect(errors).toEqual([]);
  const directory = path.resolve('../deliverables-v5/reports/lifecycle');
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'home-l1-ten-round-trips.json'),
    JSON.stringify(
      {
        evidence:
          'Ten actual same-document ClientRouter round trips. Native context handles are deliberately retained by test-only probes; this verifies disposal, not a full JavaScript heap census.',
        cycles,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
});
