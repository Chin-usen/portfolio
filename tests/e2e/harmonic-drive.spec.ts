import { expect, test, type Page } from '@playwright/test';
import type { getHarmonicDriveLifecycleSnapshot } from '../../src/components/lab/harmonic-drive/client';

const route = '/lab/harmonic-drive/';
const roots = '[data-harmonic-drive]';
const partIds = [
  'input-shaft',
  'wave-generator',
  'flexible-bearing',
  'flexspline',
  'circular-spline',
  'cross-roller-bearing',
  'output-flange',
  'housing',
  'endcap',
];
const viewerChunk = /\/_astro\/viewer\.[^/]+\.js$/;
type Snapshot = ReturnType<typeof getHarmonicDriveLifecycleSnapshot>;
type NativeSnapshot = {
  created: number;
  live: number;
  buffers: number;
  observedStages: number;
  pendingFrames: number;
};

async function capableDevice(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

async function lifecycle(page: Page): Promise<Snapshot> {
  return page.evaluate(() => Reflect.get(window, 'harmonicDriveLifecycle').snapshot());
}

async function viewer(page: Page) {
  const current = (await lifecycle(page)).active[0]?.viewer;
  expect(current).toBeTruthy();
  return current!;
}

async function setRange(page: Page, selector: string, value: string) {
  await page.locator(selector).evaluate((element, next) => {
    (element as HTMLInputElement).value = next;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function expectNumber(page: Page, selector: string, value: number, precision = 2) {
  await expect
    .poll(async () =>
      Number.parseFloat((await page.locator(selector).innerText()).replace('−', '-')),
    )
    .toBeCloseTo(value, precision);
}

async function expectStaticExplosion(page: Page) {
  const diagram = page.locator('[data-hd-static-explode]');
  await expect(diagram).toBeVisible();
  const layer = diagram.locator('[data-hd-static-layer="flexspline"]');
  await setRange(page, '[data-hd-explode]', '0');
  const assembled = await layer.getAttribute('transform');
  expect(assembled).toBeTruthy();
  const assembledX = await layer.evaluate((element) => element.getBoundingClientRect().x);
  await setRange(page, '[data-hd-explode]', '100');
  await expect(layer).not.toHaveAttribute('transform', assembled!);
  await expect
    .poll(async () =>
      Math.abs((await layer.evaluate((element) => element.getBoundingClientRect().x)) - assembledX),
    )
    .toBeGreaterThan(1);
}

// These deliberately retained native handles are cleanup evidence, not a heap census.
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
        if (target.closest('[data-harmonic-drive]')) {
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
    Reflect.set(window, 'harmonicNativeSnapshot', () => ({
      created: contexts.length,
      live: contexts.filter((context) => !context.isContextLost()).length,
      buffers: buffers.size,
      observedStages: observedStages.size,
      pendingFrames: pendingFrames.size,
    }));
  });
}

async function nativeResources(page: Page): Promise<NativeSnapshot> {
  return page.evaluate(() => Reflect.get(window, 'harmonicNativeSnapshot')());
}

for (const prefix of ['', '/en']) {
  test(
    prefix + ' harmonic L4 links nine localized parts, modes and keyboard camera controls',
    async ({ page }) => {
      await capableDevice(page);
      await page.goto(prefix + route);
      const root = page.locator(roots);
      await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
      await expect(root.locator('.l1-kicker')).toContainText('L4');
      await expect(root.locator('[data-l1-part]')).toHaveCount(9);
      await expect(root.locator('canvas[data-hd-webgl]')).toBeVisible();
      const initial = await viewer(page);
      expect(initial.geometryCount).toBeGreaterThan(0);
      expect(initial.meshCount).toBeGreaterThanOrEqual(9);
      expect(initial.rendererInfo.contextLost).toBe(false);
      expect(initial.playing).toBe(false);
      await root.locator('.hd-keyboard-help summary').click();
      await expect(root.locator('.hd-keyboard-help p')).toBeVisible();
      await expect(root.locator('.hd-keyboard-help p')).toContainText('Home');
      await root.locator('.hd-keyboard-help summary').click();

      const names = new Set<string>();
      for (const id of partIds) {
        const button = root.locator('[data-l1-part="' + id + '"]');
        await button.focus();
        await page.keyboard.press('Enter');
        await expect(root).toHaveAttribute('data-selected', id);
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        expect((await viewer(page)).selectedId).toBe(id);
        for (const field of ['name', 'role', 'features', 'material']) {
          const text = (await root.locator('[data-l1-' + field + ']').innerText()).trim();
          expect(text.length).toBeGreaterThanOrEqual(2);
          expect(text).not.toMatch(/\uFFFD|\?{2,}/);
          if (prefix === '') expect(text).toMatch(/[\u3400-\u9fff]/);
          else expect(text).toMatch(/[A-Za-z]/);
        }
        names.add(await root.locator('[data-l1-name]').innerText());
      }
      expect(names.size).toBe(9);
      await root.locator('[data-l1-mode="mechanism"]').click();
      await expect(root).toHaveAttribute('data-mode', 'mechanism');
      await expect.poll(async () => (await viewer(page)).presentation).toBe('mechanism');
      await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
      expect((await viewer(page)).visiblePartIds.sort()).toEqual(
        partIds.filter((id) => !['housing', 'endcap'].includes(id)).sort(),
      );
      expect((await viewer(page)).playing).toBe(false);
      await root.locator('[data-l1-mode="whole"]').click();
      await expect
        .poll(async () => (await viewer(page)).visiblePartIds.sort())
        .toEqual([...partIds].sort());
      await setRange(page, '[data-hd-explode]', '0');
      await expect.poll(async () => (await viewer(page)).explodeProgress).toBe(0);
      await setRange(page, '[data-hd-explode]', '100');
      await expect.poll(async () => (await viewer(page)).explodeProgress).toBe(1);

      await root.locator('[data-l1-reset]').click();
      const resetCamera = (await viewer(page)).cameraPosition;
      const resetRadius = (await viewer(page)).cameraRadius;
      await root.locator('canvas').focus();
      await page.keyboard.press('ArrowLeft');
      await expect
        .poll(async () =>
          Math.hypot(
            ...(await viewer(page)).cameraPosition.map(
              (value, index) => value - resetCamera[index]!,
            ),
          ),
        )
        .toBeGreaterThan(0.005);
      await page.keyboard.press('+');
      await expect
        .poll(async () => Math.abs((await viewer(page)).cameraRadius - resetRadius))
        .toBeGreaterThan(0.001);
      await root.locator('[data-l1-reset]').click();
      (await viewer(page)).cameraPosition.forEach((value, index) =>
        expect(value).toBeCloseTo(resetCamera[index]!, 6),
      );
    },
  );

  test(
    prefix + ' harmonic tooth edits rebuild the actual mesh and reject invalid values',
    async ({ page }) => {
      await capableDevice(page);
      await page.goto(prefix + route);
      const root = page.locator(roots);
      await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
      await expectNumber(page, '[data-hd-circular-teeth]', 202);
      await expectNumber(page, '[data-hd-ratio]', -100);
      await expect(root.locator('[data-hd-ratio]')).toHaveText('−100');
      await expectNumber(page, '[data-hd-deformation]', 0.5);
      await expectNumber(page, '[data-hd-display-deformation]', 2);
      const before = await viewer(page);
      const teeth = root.locator('[data-hd-teeth="flexTeeth"]');
      await expect(teeth).toHaveAttribute('min', '80');
      await expect(teeth).toHaveAttribute('max', '240');
      await expect(teeth).toHaveAttribute('step', '2');
      await teeth.fill('160');
      await expectNumber(page, '[data-hd-circular-teeth]', 162);
      await expectNumber(page, '[data-hd-ratio]', -80);
      await expect(root.locator('[data-hd-ratio]')).toHaveText('−80');
      await expect.poll(async () => (await viewer(page)).parameters.flexTeeth).toBe(160);
      const rebuilt = await viewer(page);
      expect(rebuilt.geometryRevision).toBeGreaterThan(before.geometryRevision);
      expect(rebuilt.flexGeometryId).not.toBe(before.flexGeometryId);
      expect(rebuilt.actualFlexBoundsMm).not.toEqual(before.actualFlexBoundsMm);
      expect(rebuilt.parameters.circularTeeth).toBe(162);

      for (const invalid of ['161', '79', '242', '160.5', '']) {
        await teeth.fill(invalid);
        await expect(teeth).toHaveAttribute('aria-invalid', 'true');
        await expect(root.locator('[data-hd-parameter-status]')).toHaveAttribute(
          'data-error',
          'true',
        );
        await expectNumber(page, '[data-hd-ratio]', -80);
        expect((await viewer(page)).parameters.flexTeeth).toBe(160);
        expect((await viewer(page)).flexGeometryId).toBe(rebuilt.flexGeometryId);
      }
      await teeth.fill('240');
      await expect(teeth).not.toHaveAttribute('aria-invalid', 'true');
      await expectNumber(page, '[data-hd-circular-teeth]', 242);
      await expectNumber(page, '[data-hd-ratio]', -120);
      await expect.poll(async () => (await viewer(page)).parameters.flexTeeth).toBe(240);
      await teeth.fill('80');
      await expectNumber(page, '[data-hd-circular-teeth]', 82);
      await expectNumber(page, '[data-hd-ratio]', -40);
      await expect.poll(async () => (await viewer(page)).parameters.flexTeeth).toBe(80);
    },
  );

  test(
    prefix + ' static harmonic lesson retains phase, parts and calculations without heavy requests',
    async ({ page }) => {
      const heavyRequests: string[] = [];
      page.on('request', (request) => {
        if (/\.glb(?:\?|$)|\/(?:viewer|three)[.-].*\.js/.test(request.url()))
          heavyRequests.push(request.url());
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
      expect(
        await image.evaluate(
          (element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
        ),
      ).toBe(true);
      for (const id of partIds) {
        await root.locator('[data-l1-part="' + id + '"]').click();
        await expect(root).toHaveAttribute('data-selected', id);
        await expect(root.locator('[data-l1-material]')).not.toHaveText('');
      }
      await root.locator('[data-hd-teeth="flexTeeth"]').fill('160');
      await expectNumber(page, '[data-hd-ratio]', -80);
      await root.locator('[data-hd-rpm-number]').fill('3000');
      await expect(root.locator('[data-hd-rpm]')).toHaveValue('3000');
      await expectNumber(page, '[data-hd-output-rpm]', -37.5);
      const startTransform = await root
        .locator('[data-hd-diagram-wave-group]')
        .getAttribute('transform');
      await setRange(page, '[data-hd-phase]', '180');
      await expectNumber(page, '[data-hd-phase-output]', 180);
      await expectNumber(page, '[data-hd-output-phase]', -2.25);
      await expect(root.locator('[data-hd-diagram-wave-group]')).not.toHaveAttribute(
        'transform',
        startTransform!,
      );
      await expect(root.locator('[data-hd-play]')).toBeDisabled();
      await expectStaticExplosion(page);
      expect((await lifecycle(page)).active[0]?.viewer).toBeNull();
      expect(heavyRequests).toEqual([]);
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
    },
  );
}

test('harmonic manual phase deforms the mesh and rotates the actual output oppositely', async ({
  page,
}) => {
  await capableDevice(page);
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
  await setRange(page, '[data-hd-phase]', '0');
  const start = await viewer(page);
  await setRange(page, '[data-hd-phase]', '90');
  await expect
    .poll(async () => (await viewer(page)).actualInputRotationRad)
    .toBeCloseTo(Math.PI / 2, 5);
  const quarter = await viewer(page);
  expect(quarter.actualOutputRotationRad).toBeCloseTo(-Math.PI / 200, 5);
  expect(quarter.actualFlexMaterialRotationRad).toBeCloseTo(quarter.actualOutputRotationRad, 5);
  expect(quarter.toothTipWorldMm).not.toEqual(start.toothTipWorldMm);
  expect(quarter.actualFlexBoundsMm).not.toEqual(start.actualFlexBoundsMm);
  expect(quarter.engagementAngles[0]).toBeCloseTo(Math.PI / 2, 5);
  expect(quarter.engagementAngles[1] - quarter.engagementAngles[0]).toBeCloseTo(Math.PI, 5);
  await expectNumber(page, '[data-hd-output-phase]', -0.9);
  expect(quarter.playing).toBe(false);
  await setRange(page, '[data-hd-phase]', '360');
  await expect
    .poll(async () => (await viewer(page)).actualOutputRotationRad)
    .toBeCloseTo(-Math.PI / 50, 5);
  await expectNumber(page, '[data-hd-output-phase]', -3.6);
});

test('harmonic speed controls synchronize and motion starts only on Play', async ({ page }) => {
  await capableDevice(page);
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
  await expect(root.locator('[data-hd-play]')).toHaveAttribute('aria-pressed', 'false');
  await setRange(page, '[data-hd-rpm]', '1800');
  await expect(root.locator('[data-hd-rpm-number]')).toHaveValue('1800');
  await expectNumber(page, '[data-hd-output-rpm]', -18);
  expect((await viewer(page)).playing).toBe(false);
  await root.locator('[data-hd-rpm-number]').fill('3000');
  await expect(root.locator('[data-hd-rpm]')).toHaveValue('3000');
  await expectNumber(page, '[data-hd-output-rpm]', -30);
  await expect.poll(async () => (await viewer(page)).inputRpm).toBe(3000);
  await expectNumber(page, '[data-hd-displayed-rpm]', 50);
  expect((await viewer(page)).timeFactor).toBe(1 / 60);
  for (const invalid of ['3001', '-1', '1.5', '']) {
    await root.locator('[data-hd-rpm-number]').fill(invalid);
    await expect(root.locator('[data-hd-rpm-number]')).toHaveAttribute('aria-invalid', 'true');
    await expectNumber(page, '[data-hd-output-rpm]', -30);
    expect((await viewer(page)).inputRpm).toBe(3000);
  }
  await root.locator('[data-hd-rpm-number]').fill('3000');
  await setRange(page, '[data-hd-phase]', '0');
  await root.locator('[data-hd-play]').click();
  await expect(root.locator('[data-hd-play]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await viewer(page)).actualInputRotationRad).toBeGreaterThan(0.05);
  const playing = await viewer(page);
  expect(playing.actualOutputRotationRad).toBeLessThan(0);
  expect(playing.actualOutputRotationRad).toBeCloseTo(-playing.actualInputRotationRad / 100, 5);
  const sample = await page.evaluate(async () => {
    const current = () =>
      Reflect.get(window, 'harmonicDriveLifecycle').snapshot().active[0].viewer
        .actualInputRotationRad as number;
    const angle = current();
    const time = performance.now();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
    return { radians: current() - angle, seconds: (performance.now() - time) / 1000 };
  });
  // Native frame timing varies under software WebGL; this still distinguishes the
  // disclosed 1/60 playback speed from physical speed or an extra 1/60 slowdown.
  const expectedTravel = (3000 / 60) * (2 * Math.PI) * (1 / 60) * sample.seconds;
  expect(sample.radians).toBeGreaterThan(expectedTravel * 0.25);
  expect(sample.radians).toBeLessThan(expectedTravel * 1.4);
  await root.locator('[data-hd-play]').click();
  await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
  const paused = (await viewer(page)).actualInputRotationRad;
  // Waiting for two browser animation ticks proves a paused viewer does not advance.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect((await viewer(page)).actualInputRotationRad).toBe(paused);
  await root.locator('[data-hd-rpm-number]').fill('0');
  await expect(root.locator('[data-hd-rpm]')).toHaveValue('0');
  await expectNumber(page, '[data-hd-output-rpm]', 0);
  await root.locator('[data-hd-play]').click();
  await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
  expect((await viewer(page)).actualInputRotationRad).toBe(paused);
});

test('a real harmonic canvas pointer selects an exposed mesh', async ({ page }) => {
  await capableDevice(page);
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
  await root.locator('[data-l1-mode="mechanism"]').click();
  await setRange(page, '[data-hd-explode]', '100');
  await expect.poll(async () => (await viewer(page)).explodeProgress).toBe(1);
  await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
  const canvas = root.locator('canvas[data-hd-webgl]');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const targets = (await viewer(page)).pickTargets;
  let point: { partId: string; x: number; y: number } | undefined;
  for (const target of targets) {
    const candidate = { partId: target.partId, x: box.x + target.x, y: box.y + target.y };
    if (
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.matches('canvas[data-hd-webgl]'),
        candidate,
      )
    ) {
      point = candidate;
      break;
    }
  }
  expect(
    point,
    'at least one exposed actual surface must be reachable through the canvas',
  ).toBeTruthy();
  await root
    .locator('[data-l1-part="' + (point!.partId === 'housing' ? 'endcap' : 'housing') + '"]')
    .click();
  await canvas.scrollIntoViewIfNeeded();
  // Recalculate page coordinates after the part button scrolls into view.
  const currentBox = (await canvas.boundingBox())!;
  const target = (await viewer(page)).pickTargets.find((item) => item.partId === point!.partId)!;
  await page.mouse.click(currentBox.x + target.x, currentBox.y + target.y);
  await expect(root).toHaveAttribute('data-selected', point!.partId);
  expect((await viewer(page)).selectedId).toBe(point!.partId);
});

test('a low-resource device has a functional harmonic static lesson with no heavy downloads', async ({
  page,
}) => {
  const heavyRequests: string[] = [];
  page.on('request', (request) => {
    if (/\.glb(?:\?|$)|\/(?:viewer|three)[.-].*\.js/.test(request.url()))
      heavyRequests.push(request.url());
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'fallback');
  await expect(root.locator('canvas')).toHaveCount(0);
  await root.locator('[data-l1-part="flexible-bearing"]').click();
  await expect(root).toHaveAttribute('data-selected', 'flexible-bearing');
  await root.locator('[data-hd-teeth="flexTeeth"]').fill('160');
  await expectNumber(page, '[data-hd-ratio]', -80);
  await setRange(page, '[data-hd-phase]', '360');
  await expectNumber(page, '[data-hd-output-phase]', -4.5);
  await expectStaticExplosion(page);
  expect((await lifecycle(page)).active[0]?.viewer).toBeNull();
  expect(heavyRequests).toEqual([]);
});

for (const interruption of ['navigation', 'reduced-motion'] as const) {
  test(
    'harmonic ' + interruption + ' during a pending viewer import does not allocate a late context',
    async ({ page }) => {
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
        if (interruption === 'navigation') {
          await page.locator('.site-name').first().click();
          await expect(page).toHaveURL(/\/$/);
          await expect(page.locator(roots)).toHaveCount(0);
        } else {
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await expect(page.locator(roots)).toHaveAttribute('data-renderer', 'fallback');
        }
        release();
        await page.evaluate(async (url) => {
          await import(url);
          await Promise.resolve();
          await Promise.resolve();
        }, requestedUrl);
        expect((await nativeResources(page)).created).toBe(0);
        expect((await nativeResources(page)).observedStages).toBe(0);
        if (interruption === 'navigation') {
          expect((await lifecycle(page)).active).toHaveLength(0);
          expect((await lifecycle(page)).released.at(-1)?.listenersAborted).toBe(true);
        } else {
          await page.locator('[data-hd-teeth="flexTeeth"]').fill('160');
          await expectNumber(page, '[data-hd-ratio]', -80);
        }
      } finally {
        release();
      }
    },
  );
}

test('harmonic native context loss preserves selection and calculations and stops animation', async ({
  page,
}) => {
  await capableDevice(page);
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
  await root.locator('[data-l1-part="flexspline"]').click();
  await root.locator('[data-hd-play]').click();
  expect(
    await root.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      extension?.loseContext();
      return Boolean(extension);
    }),
  ).toBe(true);
  await expect(root).toHaveAttribute('data-renderer', 'fallback');
  await expect(root.locator('canvas')).toHaveCount(0);
  await expect(root.locator('[data-l1-preview]')).toBeVisible();
  await expect(root).toHaveAttribute('data-selected', 'flexspline');
  await expect(root.locator('[data-hd-play]')).toHaveAttribute('aria-pressed', 'false');
  await root.locator('[data-hd-teeth="flexTeeth"]').fill('160');
  await expectNumber(page, '[data-hd-ratio]', -80);
  const released = await viewer(page);
  expect(released.disposed).toBe(true);
  expect(released.scheduledFrame).toBe(false);
  expect(released.geometryCount).toBe(0);
  expect(released.ownedListeners).toBe(0);
});

test('ten actual Home to harmonic client-route round trips release native resources and stale controls', async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await capableDevice(page);
  await observeResources(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => Reflect.set(window, 'harmonicRouteSession', 'same-document'));
  const cycles = [];
  for (let index = 0; index < 10; index++) {
    await page.locator('a[href="/lab/"]').first().click();
    await page
      .locator('a[href="' + route + '"]')
      .first()
      .click();
    await expect(page.locator(roots)).toHaveAttribute('data-renderer', 'webgl', {
      timeout: 30_000,
    });
    const active = await lifecycle(page);
    const native = await nativeResources(page);
    expect(active.active).toHaveLength(1);
    expect(native.live).toBe(1);
    expect(native.created).toBe(index + 1);
    expect(native.buffers).toBeGreaterThan(0);
    expect(native.observedStages).toBeGreaterThan(0);
    await page.locator('[data-hd-play]').click();
    const detached = await page.locator(roots).elementHandle();
    await page.locator('.site-name').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(roots)).toHaveCount(0);
    await expect.poll(async () => (await lifecycle(page)).active.length).toBe(0);
    await expect.poll(async () => (await nativeResources(page)).live).toBe(0);
    await expect.poll(async () => (await nativeResources(page)).pendingFrames).toBe(0);
    const nativeReleased = await nativeResources(page);
    expect(nativeReleased.buffers).toBe(0);
    expect(nativeReleased.observedStages).toBe(0);
    const released = (await lifecycle(page)).released.at(-1)!;
    expect(released.disposed).toBe(true);
    expect(released.listenersAborted).toBe(true);
    expect(released.observersConnected).toBe(false);
    expect(released.pendingLoad).toBe(false);
    expect(released.viewer?.disposed).toBe(true);
    expect(released.viewer?.scheduledFrame).toBe(false);
    expect(released.viewer?.ownedListeners).toBe(0);
    expect(released.viewer?.controlsDisposed).toBe(true);
    expect(released.viewer?.geometryCount).toBe(0);
    expect(released.viewer?.rendererInfo.contextLost).toBe(true);
    expect(
      await detached!.evaluate((element) => {
        const ratio = element.querySelector('[data-hd-ratio]')!;
        const before = ratio.textContent;
        const input = element.querySelector<HTMLInputElement>('[data-hd-teeth]')!;
        input.value = '160';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        element.querySelector<HTMLButtonElement>('[data-hd-play]')!.click();
        return ratio.textContent === before;
      }),
    ).toBe(true);
    expect((await lifecycle(page)).active).toHaveLength(0);
    expect((await nativeResources(page)).created).toBe(index + 1);
    expect(await page.evaluate(() => Reflect.get(window, 'harmonicRouteSession'))).toBe(
      'same-document',
    );
    await detached!.dispose();
    cycles.push({ cycle: index + 1, active, native, released, nativeReleased });
  }
  expect(errors).toEqual([]);
  await testInfo.attach('harmonic-ten-round-trips', {
    contentType: 'application/json',
    body: JSON.stringify(
      {
        evidence:
          'Native context/buffer, ResizeObserver and RAF probes plus retained detached controls across ten real same-document trips. These intentionally retained probe handles are not a heap census.',
        cycles,
        errors,
      },
      null,
      2,
    ),
  });
});

test('harmonic synthesized touch rotates, cancels cleanly and updates native sliders', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await capableDevice(page);
    await page.goto('http://127.0.0.1:4322' + route);
    const root = page.locator(roots);
    await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
    const canvas = root.locator('canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    const session = await context.newCDPSession(page);
    const initial = await viewer(page);
    const initialScroll = await page.evaluate(() => scrollY);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', dx = 0) =>
      session.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x: x + dx, y, id: 1 }],
      });
    await touch('touchStart');
    await touch('touchMove', 35);
    await touch('touchMove', 70);
    await touch('touchCancel');
    await expect
      .poll(async () => (await viewer(page)).cameraPosition)
      .not.toEqual(initial.cameraPosition);
    expect(await page.evaluate(() => scrollY)).toBe(initialScroll);
    const cancelled = await viewer(page);
    await touch('touchStart');
    await touch('touchMove', -35);
    await touch('touchMove', -70);
    await touch('touchEnd');
    await expect
      .poll(async () => (await viewer(page)).cameraPosition)
      .not.toEqual(cancelled.cameraPosition);
    await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
    await session.detach();
    for (const selector of ['[data-hd-explode]', '[data-hd-phase]', '[data-hd-rpm]']) {
      const slider = root.locator(selector);
      await slider.scrollIntoViewIfNeeded();
      const bounds = (await slider.boundingBox())!;
      const before = await slider.inputValue();
      await page.touchscreen.tap(bounds.x + bounds.width * 0.7, bounds.y + bounds.height / 2);
      await expect(slider).not.toHaveValue(before);
      if (selector === '[data-hd-phase]') {
        await expect(root.locator('.hd-phase-diagram .hd-diagram')).toBeInViewport();
        await expect(root.locator('[data-hd-output-phase]')).toBeInViewport();
      }
    }
    const phase = Number(await root.locator('[data-hd-phase]').inputValue());
    const rpm = Number(await root.locator('[data-hd-rpm]').inputValue());
    await expectNumber(page, '[data-hd-output-phase]', phase / -100);
    await expect(root.locator('[data-hd-rpm-number]')).toHaveValue(String(rpm));
    expect((await viewer(page)).playing).toBe(false);
    await testInfo.attach('harmonic-synthesized-touch', {
      contentType: 'application/json',
      body: JSON.stringify(
        {
          method:
            'Chromium mobile context; CDP touch drag/cancel/end and Playwright touchscreen taps. No physical-device claim.',
          viewport: [390, 844],
          canvasDragChangedCamera: true,
          cancelledDragRecovered: true,
          canvasDidNotScrollPage: true,
          slidersResponded: ['axial separation', 'input phase', 'input speed'],
          phase,
          rpm,
        },
        null,
        2,
      ),
    });
  } finally {
    await context.close();
  }
});
