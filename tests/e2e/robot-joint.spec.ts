import { expect, test, type Page } from '@playwright/test';
import type { getRobotJointLifecycleSnapshot } from '../../src/components/lab/robot-joint/client';

const route = '/lab/robot-joint/';
const roots = '[data-robot-joint]';
const partIds = [
  'housing',
  'motor-stator',
  'motor-rotor',
  'harmonic-reducer',
  'motor-encoder',
  'output-encoder',
  'fail-safe-brake',
  'driver-board',
  'cross-roller-bearing',
  'hollow-shaft',
  'thermal-pad',
  'front-cover',
  'rear-cover',
  'output-flange',
];
const flowSelections = [
  ['dc-bus', 'driver-board'],
  ['driver', 'driver-board'],
  ['motor', 'motor-stator'],
  ['reducer', 'harmonic-reducer'],
  ['output', 'output-flange'],
  ['motor-feedback', 'motor-encoder'],
  ['output-feedback', 'output-encoder'],
  ['brake', 'fail-safe-brake'],
] as const;
const viewerChunk = /\/_astro\/viewer\.[^/]+\.js$/;
type Snapshot = ReturnType<typeof getRobotJointLifecycleSnapshot>;
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
  return page.evaluate(() => Reflect.get(window, 'robotJointLifecycle').snapshot());
}

async function viewer(page: Page) {
  const current = (await lifecycle(page)).active[0]?.viewer;
  expect(current).toBeTruthy();
  return current!;
}

async function setRange(page: Page, value: string) {
  await page.locator('[data-rj-separation]').evaluate((element, next) => {
    (element as HTMLInputElement).value = next;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function expectStaticSeparation(page: Page) {
  const layer = page.locator('[data-rj-static-layer="motor-stator"]');
  await expect(layer).toBeVisible();
  await setRange(page, '0');
  const assembled = await layer.getAttribute('transform');
  expect(assembled).toBeTruthy();
  const initial = await layer.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y };
  });
  await setRange(page, '100');
  await expect(layer).not.toHaveAttribute('transform', assembled!);
  await expect
    .poll(async () =>
      layer.evaluate((element, start) => {
        const box = element.getBoundingClientRect();
        return Math.hypot(box.x - start.x, box.y - start.y);
      }, initial),
    )
    .toBeGreaterThan(1);
}

async function expectFlowSelection(page: Page, partId: string) {
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-selected', partId);
  await expect(root.locator('[data-l1-part="' + partId + '"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(root.locator('[data-rj-stage-name]')).toHaveText(
    await root.locator('[data-l1-name]').innerText(),
  );
  await expect(root.locator('[data-rj-stage-role]')).toHaveText(
    await root.locator('[data-l1-role]').innerText(),
  );
  await expect(root.locator('[data-rj-flow-selected]')).toHaveText(
    await root.locator('[data-l1-name]').innerText(),
  );
  const expected = flowSelections
    .filter(([, id]) => id === partId || (partId === 'motor-rotor' && id === 'motor-stator'))
    .map(([node]) => node);
  for (const [node] of flowSelections) {
    await expect(root.locator('[data-rj-flow-node="' + node + '"]')).toHaveAttribute(
      'aria-pressed',
      String(expected.includes(node)),
    );
  }
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
        if (target.closest('[data-robot-joint]')) {
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
    Reflect.set(window, 'robotJointNativeSnapshot', () => ({
      created: contexts.length,
      live: contexts.filter((context) => !context.isContextLost()).length,
      buffers: buffers.size,
      observedStages: observedStages.size,
      pendingFrames: pendingFrames.size,
    }));
  });
}

async function nativeResources(page: Page): Promise<NativeSnapshot> {
  return page.evaluate(() => Reflect.get(window, 'robotJointNativeSnapshot')());
}

for (const prefix of ['', '/en']) {
  test(
    prefix + ' robot joint links fourteen localized parts, modes and keyboard camera controls',
    async ({ page }) => {
      await capableDevice(page);
      await page.goto(prefix + route);
      const root = page.locator(roots);
      await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
      await expect(root).toHaveAttribute('data-selected', 'motor-stator');
      await expect(root.locator('[data-l1-part]')).toHaveCount(14);
      const canvas = root.locator('canvas[data-rj-webgl]');
      await expect(canvas).toBeVisible();
      const initial = await viewer(page);
      expect(initial.geometryCount).toBeGreaterThan(0);
      expect(initial.meshCount).toBeGreaterThanOrEqual(14);
      expect(initial.rendererInfo.contextLost).toBe(false);
      expect(initial.separation).toBe(1);
      await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
      await root.locator('.rj-keyboard-help summary').focus();
      await page.keyboard.press('Enter');
      await expect(root.locator('.rj-keyboard-help p')).toBeVisible();
      await expect(root.locator('.rj-keyboard-help p')).toContainText('Home');
      await page.keyboard.press('Enter');

      const names = new Set<string>();
      for (const id of partIds) {
        const button = root.locator('[data-l1-part="' + id + '"]');
        await button.focus();
        await page.keyboard.press('Enter');
        await expectFlowSelection(page, id);
        expect((await viewer(page)).selectedId).toBe(id);
        for (const field of ['name', 'role', 'features', 'material']) {
          const text = (await root.locator('[data-l1-' + field + ']').innerText()).trim();
          expect(text.length).toBeGreaterThanOrEqual(2);
          expect(text).not.toMatch(/\uFFFD|\?{2,}/);
          expect(text).toMatch(prefix === '' ? /[\u3400-\u9fff]/ : /[A-Za-z]/);
        }
        names.add(await root.locator('[data-l1-name]').innerText());
      }
      expect(names.size).toBe(14);
      await root.locator('[data-l1-mode="mechanism"]').click();
      await expect(root).toHaveAttribute('data-mode', 'mechanism');
      await expect.poll(async () => (await viewer(page)).presentation).toBe('mechanism');
      await expect
        .poll(async () => (await viewer(page)).visiblePartIds.sort())
        .toEqual(
          partIds.filter((id) => !['housing', 'front-cover', 'rear-cover'].includes(id)).sort(),
        );
      await root.locator('[data-l1-mode="whole"]').click();
      await expect
        .poll(async () => (await viewer(page)).visiblePartIds.sort())
        .toEqual([...partIds].sort());
      const separation = root.locator('[data-rj-separation]');
      await separation.focus();
      await page.keyboard.press('Home');
      await expect(separation).toHaveValue('0');
      await expect.poll(async () => (await viewer(page)).separation).toBe(0);
      await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
      const assembledCenters = (await viewer(page)).partCentersMm;
      await page.keyboard.press('End');
      await expect(separation).toHaveValue('100');
      await expect.poll(async () => (await viewer(page)).separation).toBe(1);
      await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
      const separatedCenters = (await viewer(page)).partCentersMm;
      for (const id of ['housing', 'motor-stator', 'thermal-pad']) {
        expect(
          Math.hypot(
            ...separatedCenters[id]!.map((value, index) => value - assembledCenters[id]![index]!),
          ),
        ).toBeGreaterThan(1);
      }

      await root.locator('[data-l1-reset]').click();
      const resetCamera = (await viewer(page)).cameraPosition;
      const resetRadius = (await viewer(page)).cameraRadius;
      await canvas.focus();
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
      await page.keyboard.press('Home');
      (await viewer(page)).cameraPosition.forEach((value, index) =>
        expect(value).toBeCloseTo(resetCamera[index]!, 6),
      );
      await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
    },
  );

  test(
    prefix + ' mobile robot joint flow links power, two encoder feedbacks and brake to real parts',
    async ({ page }) => {
      await capableDevice(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(prefix + route);
      const root = page.locator(roots);
      await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
      await expect(root.locator('[data-rj-flow-node]')).toHaveCount(8);
      for (const [node, partId] of flowSelections) {
        const button = root.locator('[data-rj-flow-node="' + node + '"]');
        await button.focus();
        await page.keyboard.press(node === 'output-feedback' ? 'Space' : 'Enter');
        await expectFlowSelection(page, partId);
        expect((await viewer(page)).selectedId).toBe(partId);
        await expect(root.locator('[data-rj-flow-context]')).not.toHaveText('');
        const bounds = (await button.boundingBox())!;
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
      }
      await root.locator('[data-l1-part="motor-rotor"]').click();
      await expectFlowSelection(page, 'motor-rotor');
      await root.locator('[data-l1-part="thermal-pad"]').click();
      await expectFlowSelection(page, 'thermal-pad');
      const neutral = await root.locator('[data-rj-flow-context]').innerText();
      expect(neutral.trim()).not.toBe('');
      await root.locator('[data-rj-flow-node="output-feedback"]').click();
      await expectFlowSelection(page, 'output-encoder');
      await expect(root.locator('[data-rj-flow-context]')).not.toHaveText(neutral);
      await expect(root.locator('[data-rj-flow-selected]')).toBeInViewport();
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      for (const [node] of flowSelections) {
        const fit = await root.locator('[data-rj-flow-node="' + node + '"]').evaluate((button) => {
          const box = button.getBoundingClientRect();
          return {
            client: button.clientHeight,
            scroll: button.scrollHeight,
            textInside: [...button.querySelectorAll('span')].every((span) => {
              const text = span.getBoundingClientRect();
              return (
                text.top >= box.top - 1 &&
                text.bottom <= box.bottom + 1 &&
                text.left >= box.left - 1 &&
                text.right <= box.right + 1
              );
            }),
          };
        });
        expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1);
        expect(fit.textInside).toBe(true);
      }
      await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
    },
  );

  test(
    prefix +
      ' reduced-motion robot joint retains the complete static lesson without heavy requests',
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
        await expectFlowSelection(page, id);
        await expect(root.locator('[data-l1-material]')).not.toHaveText('');
      }
      for (const [node, partId] of flowSelections) {
        await root.locator('[data-rj-flow-node="' + node + '"]').click();
        await expectFlowSelection(page, partId);
      }
      await expectStaticSeparation(page);
      await root.locator('[data-l1-mode="mechanism"]').click();
      await expect(root).toHaveAttribute('data-mode', 'mechanism');
      for (const id of ['housing', 'front-cover', 'rear-cover'])
        await expect(root.locator('[data-rj-static-layer="' + id + '"]')).toBeHidden();
      await expect(root.locator('[data-rj-static-layer="motor-stator"]')).toBeVisible();
      await root.locator('[data-l1-mode="whole"]').click();
      for (const id of partIds)
        await expect(root.locator('[data-rj-static-layer="' + id + '"]')).toBeVisible();
      expect((await lifecycle(page)).active[0]?.viewer).toBeNull();
      expect(heavyRequests).toEqual([]);
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
    },
  );

  test(
    prefix + ' robot joint descriptions and model poster remain readable without JavaScript',
    async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      try {
        await page.goto(String(testInfo.project.use.baseURL) + prefix + route);
        const root = page.locator(roots);
        await expect(root.locator('canvas')).toHaveCount(0);
        await expect(root.locator('[data-l1-preview]')).toBeVisible();
        const descriptions = root.locator('noscript section');
        await expect(descriptions).toHaveCount(14);
        for (const description of await descriptions.all()) {
          await expect(description.locator('h3')).not.toHaveText('');
          await expect(description.locator('dd')).toHaveCount(3);
          for (const field of await description.locator('dd').all())
            expect((await field.innerText()).trim().length).toBeGreaterThanOrEqual(2);
        }
        await expect(root.locator('[data-rj-flow-node]')).toHaveCount(8);
        const dimensions = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
      } finally {
        await context.close();
      }
    },
  );
}

test('a real robot joint canvas pointer selects a flow-linked mesh and updates all three views', async ({
  page,
}) => {
  await capableDevice(page);
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
  await root.locator('[data-l1-mode="mechanism"]').click();
  await setRange(page, '100');
  await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
  const canvas = root.locator('canvas[data-rj-webgl]');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const targets = (await viewer(page)).pickTargets;
  let point: { partId: string; x: number; y: number } | undefined;
  for (const target of targets.filter((item) =>
    flowSelections.some(([, partId]) => partId === item.partId),
  )) {
    const candidate = { partId: target.partId, x: box.x + target.x, y: box.y + target.y };
    if (
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.matches('canvas[data-rj-webgl]'),
        candidate,
      )
    ) {
      point = candidate;
      break;
    }
  }
  expect(
    point,
    'at least one real flow-linked exposed surface must be reachable through the canvas',
  ).toBeTruthy();
  await root.locator('[data-l1-part="housing"]').click();
  await canvas.scrollIntoViewIfNeeded();
  const currentBox = (await canvas.boundingBox())!;
  const target = (await viewer(page)).pickTargets.find((item) => item.partId === point!.partId)!;
  await page.mouse.click(currentBox.x + target.x, currentBox.y + target.y);
  await expectFlowSelection(page, point!.partId);
  expect((await viewer(page)).selectedId).toBe(point!.partId);
});

test('a low-resource device has a functional robot joint static lesson with no heavy downloads', async ({
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
  await root.locator('[data-rj-flow-node="motor-feedback"]').click();
  await expectFlowSelection(page, 'motor-encoder');
  await root.locator('[data-l1-part="output-encoder"]').click();
  await expectFlowSelection(page, 'output-encoder');
  await expectStaticSeparation(page);
  expect((await lifecycle(page)).active[0]?.viewer).toBeNull();
  expect(heavyRequests).toEqual([]);
});
for (const interruption of ['navigation', 'reduced-motion'] as const) {
  test(
    'robot joint ' +
      interruption +
      ' during a pending viewer import does not allocate a late context',
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
          await page.locator('[data-rj-flow-node="brake"]').click();
          await expectFlowSelection(page, 'fail-safe-brake');
          await expectStaticSeparation(page);
        }
      } finally {
        release();
      }
    },
  );
}

test('robot joint native context loss preserves selected part and flow and releases real resources', async ({
  page,
}) => {
  await capableDevice(page);
  await observeResources(page);
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
  await root.locator('[data-rj-flow-node="output-feedback"]').click();
  await expectFlowSelection(page, 'output-encoder');
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
  await expectFlowSelection(page, 'output-encoder');
  await root.locator('[data-rj-flow-node="brake"]').click();
  await expectFlowSelection(page, 'fail-safe-brake');
  await expectStaticSeparation(page);
  const released = await viewer(page);
  expect(released.disposed).toBe(true);
  expect(released.scheduledFrame).toBe(false);
  expect(released.geometryCount).toBe(0);
  expect(released.ownedListeners).toBe(0);
  expect(released.controlsDisposed).toBe(true);
  await expect.poll(async () => (await nativeResources(page)).live).toBe(0);
  expect((await nativeResources(page)).buffers).toBe(0);
  expect((await nativeResources(page)).observedStages).toBe(0);
});

test('ten actual Home to robot joint client-route round trips release native resources and stale controls', async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await capableDevice(page);
  await observeResources(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => Reflect.set(window, 'robotJointRouteSession', 'same-document'));
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
    await page.locator('[data-rj-flow-node="brake"]').click();
    await setRange(page, '35');
    await expect.poll(async () => (await viewer(page)).separation).toBe(0.35);
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
        const output = element.querySelector('[data-rj-separation-output]')!;
        const selected = element.getAttribute('data-selected');
        const before = output.textContent;
        const input = element.querySelector<HTMLInputElement>('[data-rj-separation]')!;
        input.value = '80';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        element.querySelector<HTMLButtonElement>('[data-rj-flow-node="motor"]')!.click();
        return output.textContent === before && element.getAttribute('data-selected') === selected;
      }),
    ).toBe(true);
    expect((await lifecycle(page)).active).toHaveLength(0);
    expect((await nativeResources(page)).created).toBe(index + 1);
    expect(await page.evaluate(() => Reflect.get(window, 'robotJointRouteSession'))).toBe(
      'same-document',
    );
    await detached!.dispose();
    cycles.push({ cycle: index + 1, active, native, released, nativeReleased });
  }
  expect(errors).toEqual([]);
  await testInfo.attach('robot-joint-route-lifecycle-ten-trips', {
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

test('robot joint synthesized touch rotates, cancels cleanly and updates native separation and flow', async ({
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
    await page.goto(String(testInfo.project.use.baseURL) + route);
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
    const slider = root.locator('[data-rj-separation]');
    await slider.scrollIntoViewIfNeeded();
    const bounds = (await slider.boundingBox())!;
    const before = await slider.inputValue();
    await page.touchscreen.tap(bounds.x + bounds.width * 0.7, bounds.y + bounds.height / 2);
    await expect(slider).not.toHaveValue(before);
    const separation = Number(await slider.inputValue()) / 100;
    await expect.poll(async () => (await viewer(page)).separation).toBe(separation);
    const flow = root.locator('[data-rj-flow-node="output-feedback"]');
    await flow.scrollIntoViewIfNeeded();
    const flowBounds = (await flow.boundingBox())!;
    await page.touchscreen.tap(
      flowBounds.x + flowBounds.width / 2,
      flowBounds.y + flowBounds.height / 2,
    );
    await expectFlowSelection(page, 'output-encoder');
    await expect(root.locator('[data-rj-flow-selected]')).toBeInViewport();
    await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
    const idle = await viewer(page);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect((await viewer(page)).partCentersMm).toEqual(idle.partCentersMm);
    await testInfo.attach('robot-joint-synthesized-touch', {
      contentType: 'application/json',
      body: JSON.stringify(
        {
          method:
            'Chromium mobile context; CDP touch drag/cancel/end and Playwright touchscreen taps. No physical-device claim.',
          viewport: [390, 844],
          canvasDragChangedCamera: true,
          cancelledDragRecovered: true,
          canvasDidNotScrollPage: true,
          slidersResponded: ['axial separation'],
          separation,
          flowTappedPart: 'output-encoder',
        },
        null,
        2,
      ),
    });
  } finally {
    await context.close();
  }
});

test('robot joint reset fits visible bounds with useful occupancy across callout breakpoints', async ({
  page,
}, testInfo) => {
  await capableDevice(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
  const canvas = root.locator('canvas[data-rj-webgl]');
  const observations = [];
  for (const width of [1440, 1100, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const mode of ['whole', 'mechanism']) {
      await root.locator('[data-l1-mode="' + mode + '"]').click();
      for (const separation of [0, 50, 100]) {
        await setRange(page, String(separation));
        await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
        const diagnostic = await viewer(page);
        const projected = diagnostic.projectedBounds!;
        const canvasBox = (await canvas.boundingBox())!;
        const inset = width > 1100 ? 136 : 0;
        expect(diagnostic.presentation).toBe(mode);
        expect(diagnostic.separation).toBe(separation / 100);
        expect(projected.calloutInset).toBe(inset);
        expect(projected.viewportWidth).toBeCloseTo(canvasBox.width, 1);
        expect(projected.viewportHeight).toBeCloseTo(canvasBox.height, 1);
        expect(projected.left).toBeGreaterThanOrEqual(inset - 0.5);
        expect(projected.right).toBeLessThanOrEqual(canvasBox.width - inset + 0.5);
        expect(projected.top).toBeGreaterThanOrEqual(-0.5);
        expect(projected.bottom).toBeLessThanOrEqual(canvasBox.height + 0.5);
        expect(projected.near).toBeGreaterThanOrEqual(-1);
        expect(projected.far).toBeLessThanOrEqual(1);
        const occupancy = Math.max(
          (projected.right - projected.left) / (canvasBox.width - 2 * inset),
          (projected.bottom - projected.top) / canvasBox.height,
        );
        expect(occupancy, 'the reset model must not collapse to a thumbnail').toBeGreaterThan(0.65);
        expect(occupancy, 'the fitted bounds retain their viewing margin').toBeLessThan(0.93);
        observations.push({ width, mode, separation, projected, occupancy });
      }
    }
  }
  const fittedCamera = (await viewer(page)).cameraPosition;
  await canvas.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('+');
  await expect.poll(async () => (await viewer(page)).cameraPosition).not.toEqual(fittedCamera);
  await page.keyboard.press('Home');
  await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
  (await viewer(page)).cameraPosition.forEach((value, index) =>
    expect(value).toBeCloseTo(fittedCamera[index]!, 6),
  );
  await testInfo.attach('robot-joint-projected-bound-fit', {
    contentType: 'application/json',
    body: JSON.stringify({ observations, keyboardResetRestoredFit: true }, null, 2),
  });
});

for (const prefix of ['', '/en']) {
  test(`${prefix} robot joint inherits stable mobile preview and scoped fonts`, async ({
    page,
  }) => {
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
    await page.route(/robot-joint-exploded(?:-640)?\.webp(?:\?|$)/, async (imageRoute) => {
      await imageGate;
      await imageRoute.continue();
    });
    try {
      await page.goto(`${prefix}/lab/robot-joint/`, { waitUntil: 'domcontentloaded' });
      const root = page.locator(roots);
      await expect(root).toHaveAttribute('data-renderer', 'fallback');
      await page.evaluate(() => document.fonts.ready);
      const preview = root.locator('[data-l1-preview]');
      await expect(preview).toBeVisible();
      expect(await preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(0);
      const before = await preview.boundingBox();
      expect(before!.width).toBeGreaterThan(0);
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
      const buttons = await root.locator('[data-l1-mode]').evaluateAll((modes) =>
        modes.map((mode) => {
          const box = mode.getBoundingClientRect();
          return { top: box.top, height: box.height, width: box.width };
        }),
      );
      expect(
        Math.max(...buttons.map((button) => button.top)) -
          Math.min(...buttons.map((button) => button.top)),
      ).toBeLessThan(1);
      expect(buttons.every((button) => button.width > 0 && button.height >= 44)).toBe(true);
      await expect(root.locator('.l1-kicker')).toBeVisible();
      await expect(root.locator('.l1-kicker')).toHaveText(
        prefix ? 'L5 · 3D teardown' : 'L5 · 3D 拆解',
      );
      await expect(root.locator('.l1-info dt')).toHaveText(
        prefix ? ['Role', 'Features', 'Common materials'] : ['作用', '特点', '常用材料'],
      );
      expect(fonts.filter((url) => /noto-sans-sc-\d+-/.test(url))).toEqual([]);
      expect(
        await page
          .locator('link[rel="stylesheet"]')
          .evaluateAll((links) =>
            links
              .filter((link) => (link as HTMLLinkElement).media !== 'print')
              .map((link) => link.getAttribute('href')),
          ),
      ).toEqual([]);
    } finally {
      releaseImage();
    }
  });
}
