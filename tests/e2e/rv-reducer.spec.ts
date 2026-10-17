import { expect, test, type Page } from '@playwright/test';
import type { getRvReducerLifecycleSnapshot } from '../../src/components/lab/rv-reducer/client';

const route = '/lab/rv-reducer/';
const roots = '[data-rv-reducer]';
const partIds = [
  'housing',
  'pin-ring',
  'pin',
  'input-shaft',
  'sun-gear',
  'planet-gear',
  'crankshaft',
  'cycloid-disc',
  'output-flange',
  'main-bearing',
  'needle-bearing',
  'oil-seal',
  'endcap',
];
type Snapshot = ReturnType<typeof getRvReducerLifecycleSnapshot>;

async function capableDevice(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}
async function lifecycle(page: Page): Promise<Snapshot> {
  return page.evaluate(() => Reflect.get(window, 'rvReducerLifecycle').snapshot());
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

for (const prefix of ['', '/en']) {
  test(
    prefix + ' RV L3 links all components, stages, explosion and keyboard camera controls',
    async ({ page }) => {
      await capableDevice(page);
      await page.goto(prefix + route);
      const root = page.locator(roots);
      await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
      await expect(root.locator('.l1-kicker')).toContainText('L3');
      expect((await viewer(page)).meshCount).toBe(79);
      const labelBounds = await root.locator('[data-l1-label]').evaluateAll((labels) =>
        labels
          .filter((label) => !(label as HTMLElement).hidden)
          .map((label) => {
            const box = label.getBoundingClientRect();
            const stage = label.closest('.l1-stage')!.getBoundingClientRect();
            return {
              width: box.width,
              left: box.left - stage.left,
              right: box.right - stage.right,
            };
          }),
      );
      expect(labelBounds.length).toBe(13);
      for (const bounds of labelBounds) {
        expect(bounds.width).toBeGreaterThan(28);
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(1);
      }
      expect(await root.locator('[data-l1-part]').count()).toBe(13);
      for (const id of partIds) {
        const button = root.locator('[data-l1-part="' + id + '"]');
        await button.click();
        await expect(root).toHaveAttribute('data-selected', id);
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        expect((await viewer(page)).selectedId).toBe(id);
        for (const field of ['name', 'role', 'features', 'material'])
          await expect(root.locator('[data-l1-' + field + ']')).not.toHaveText('');
      }
      for (const stage of ['first', 'second', 'whole']) {
        await root.locator('[data-l1-mode="' + stage + '"]').click();
        await expect(root).toHaveAttribute('data-mode', stage);
        await expect.poll(async () => (await viewer(page)).presentation).toBe(stage);
        await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
        const ids = (await viewer(page)).visiblePartIds;
        if (stage === 'first') {
          expect(ids).toContain('sun-gear');
          expect(ids).not.toContain('cycloid-disc');
        }
        if (stage === 'second') {
          expect(ids).toContain('cycloid-disc');
          expect(ids).not.toContain('sun-gear');
        }
        if (stage === 'whole') expect(ids.sort()).toEqual([...partIds].sort());
      }
      await setRange(page, '[data-rv-explode]', '0');
      await expect.poll(async () => (await viewer(page)).explodeProgress).toBe(0);
      await setRange(page, '[data-rv-explode]', '100');
      await expect.poll(async () => (await viewer(page)).explodeProgress).toBe(1);
      await root.locator('[data-l1-reset]').click();
      const resetCamera = (await viewer(page)).cameraPosition;
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
      await root.locator('[data-l1-reset]').click();
      const restored = (await viewer(page)).cameraPosition;
      restored.forEach((value, index) => expect(value).toBeCloseTo(resetCamera[index]!, 6));
      expect(await root.innerText()).not.toMatch(/\uFFFD|\?{2,}/);
    },
  );

  test(
    prefix + ' RV integer edits automatically rebuild; invalid edits preserve the model',
    async ({ page }) => {
      await capableDevice(page);
      await page.goto(prefix + route);
      const root = page.locator(roots);
      await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
      await expect(root.locator('[data-rv-ratio]')).toHaveText('121');
      // fill emits input; no blur or Apply action is needed for this rebuild.
      await root.locator('[data-rv-teeth="sunTeeth"]').fill('12');
      await expect(root.locator('[data-rv-ratio]')).toHaveText('101');
      await expect.poll(async () => (await viewer(page)).parameters.sunTeeth).toBe(12);
      await root.locator('[data-rv-teeth="pinCount"]').fill('41');
      await expect(root.locator('[data-rv-ratio]')).toHaveText('103.50');
      await expect.poll(async () => (await viewer(page)).meshCount).toBe(80);
      expect((await viewer(page)).parameters.lobeCount).toBe(40);
      await root.locator('[data-rv-teeth="sunTeeth"]').fill('10.5');
      await expect(root.locator('[data-rv-parameter-status]')).toHaveAttribute(
        'data-error',
        'true',
      );
      await expect(root.locator('[data-rv-ratio]')).toHaveText('103.50');
      expect((await viewer(page)).parameters.sunTeeth).toBe(12);
      // Individually in-range integers can still violate the actual bearing/web envelope.
      await root.evaluate((element) => {
        for (const [key, value] of [
          ['sunTeeth', '20'],
          ['planetTeeth', '40'],
          ['pinCount', '40'],
        ]) {
          const input = element.querySelector<HTMLInputElement>('[data-rv-teeth="' + key + '"]')!;
          input.value = value!;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await expect(root.locator('[data-rv-teeth="planetTeeth"]')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      await expect(root.locator('[data-rv-ratio]')).toHaveText('103.50');
      expect((await viewer(page)).parameters.planetTeeth).toBe(30);
      await root.locator('[data-rv-defaults]').click();
      await expect(root.locator('[data-rv-ratio]')).toHaveText('121');
      await expect.poll(async () => (await viewer(page)).meshCount).toBe(79);
      await expect(root.locator('[data-rv-parameter-status]')).toHaveAttribute(
        'data-error',
        'false',
      );
      await root.locator('[data-rv-rpm-number]').fill('3000');
      await expect(root.locator('[data-rv-output-rpm]')).toHaveText((3000 / 121).toFixed(2));
      await expect(root.locator('[data-rv-displayed-rpm]')).toHaveText('50.00');
      for (const invalidRpm of ['', '-1', '3001', '4000', '1.5']) {
        await root.locator('[data-rv-rpm-number]').fill(invalidRpm);
        await expect(root.locator('[data-rv-rpm-number]')).toHaveAttribute('aria-invalid', 'true');
        await expect(root.locator('[data-rv-speed-status]')).toBeVisible();
        await expect(root.locator('[data-rv-speed-status]')).toContainText('3000 rpm');
        await expect(root).toHaveAttribute('data-rpm', '3000');
        await expect(root.locator('[data-rv-output-rpm]')).toHaveText((3000 / 121).toFixed(2));
      }
      await root.locator('[data-rv-rpm-number]').fill('3000');
      await expect(root.locator('[data-rv-speed-status]')).toBeHidden();
      await expect(root.locator('[data-rv-rpm-number]')).toHaveAttribute(
        'aria-describedby',
        /rv-speed-status/,
      );
      await root.locator('[data-rv-play]').click();
      await expect.poll(async () => (await viewer(page)).inputAngleRad).toBeGreaterThan(0);
      await root.locator('[data-rv-play]').click();
      await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
      await root.locator('[data-rv-rpm-number]').fill('0');
      await expect(root.locator('[data-rv-output-rpm]')).toHaveText('0.00');
      await root.locator('[data-rv-play]').click();
      await expect.poll(async () => (await viewer(page)).scheduledFrame).toBe(false);
      const stoppedAngle = (await viewer(page)).inputAngleRad;
      await page.waitForTimeout(100);
      expect((await viewer(page)).inputAngleRad).toBe(stoppedAngle);
      expect((await viewer(page)).timeFactor).toBe(1 / 60);
    },
  );

  test(
    prefix + ' reduced-motion RV uses real responsive WebP and keeps all local lesson controls',
    async ({ page }) => {
      const heavyRequests: string[] = [];
      page.on('request', (request) => {
        const url = request.url();
        if (/\.glb(?:\?|$)|\/(?:viewer|three)[.-].*\.js/.test(url)) heavyRequests.push(url);
      });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(prefix + route);
      const root = page.locator(roots);
      await expect(root).toHaveAttribute('data-renderer', 'fallback');
      await expect(root.locator('canvas')).toHaveCount(0);
      const image = root.locator('[data-l1-preview]');
      await expect(image).toBeVisible();
      expect(
        await image.evaluate(
          (element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
        ),
      ).toBe(true);
      await expect(image).toHaveAttribute('srcset', /640w.*1600w/);
      for (const id of partIds) {
        await root.locator('[data-l1-part="' + id + '"]').click();
        await expect(root).toHaveAttribute('data-selected', id);
        await expect(root.locator('[data-l1-material]')).not.toHaveText('');
      }
      await root.locator('[data-rv-teeth="sunTeeth"]').fill('12');
      await expect(root.locator('[data-rv-ratio]')).toHaveText('101');
      await root.locator('[data-rv-rpm-number]').fill('3000');
      await expect(root.locator('[data-rv-output-rpm]')).toHaveText((3000 / 101).toFixed(2));
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

test('a low-resource RV device gets the complete static lesson', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'fallback');
  await expect(root.locator('canvas')).toHaveCount(0);
  await root.locator('[data-l1-part="needle-bearing"]').click();
  await expect(root).toHaveAttribute('data-selected', 'needle-bearing');
  await root.locator('[data-rv-teeth="sunTeeth"]').fill('12');
  await expect(root.locator('[data-rv-ratio]')).toHaveText('101');
  expect((await lifecycle(page)).active[0]?.viewer).toBeNull();
});

test('RV context loss preserves static selection and calculations', async ({ page }) => {
  await capableDevice(page);
  await page.goto(route);
  const root = page.locator(roots);
  await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
  await root.locator('[data-rv-play]').click();
  await root
    .locator('canvas')
    .evaluate((element: HTMLCanvasElement) =>
      element.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext(),
    );
  await expect(root).toHaveAttribute('data-renderer', 'fallback');
  await expect(root.locator('canvas')).toHaveCount(0);
  await expect(root.locator('[data-l1-preview]')).toBeVisible();
  await expect(root.locator('[data-rv-play]')).toHaveAttribute('aria-pressed', 'false');
  await root.locator('[data-rv-teeth="sunTeeth"]').fill('12');
  await expect(root.locator('[data-rv-ratio]')).toHaveText('101');
  expect((await viewer(page)).disposed).toBe(true);
});

test('ten Home to RV client-route round trips release each actual WebGL context', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await capableDevice(page);
  await page.addInitScript(() => {
    const contexts: WebGLRenderingContext[] = [];
    HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
      apply(target, receiver, args) {
        const result = Reflect.apply(target, receiver, args);
        if ((args[0] === 'webgl' || args[0] === 'webgl2') && result && !contexts.includes(result))
          contexts.push(result);
        return result;
      },
    });
    Reflect.set(window, 'rvNativeContextSnapshot', () => ({
      created: contexts.length,
      live: contexts.filter((context) => !context.isContextLost()).length,
    }));
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => Reflect.set(window, 'rvRouteSession', 'same-document'));
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
    const native = await page.evaluate(() => Reflect.get(window, 'rvNativeContextSnapshot')());
    expect(active.active).toHaveLength(1);
    expect(native.live).toBe(1);
    expect(native.created).toBe(index + 1);
    await page.locator('[data-rv-play]').click();
    const detached = await page.locator('[data-rv-play]').elementHandle();
    await page.locator('.site-name').first().click();
    await expect(page.locator(roots)).toHaveCount(0);
    await expect.poll(async () => (await lifecycle(page)).active.length).toBe(0);
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => Reflect.get(window, 'rvNativeContextSnapshot')())).live,
      )
      .toBe(0);
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
    await detached!.evaluate((button) => (button as HTMLButtonElement).click());
    expect((await lifecycle(page)).active).toHaveLength(0);
    expect(await page.evaluate(() => Reflect.get(window, 'rvRouteSession'))).toBe('same-document');
    await detached!.dispose();
    cycles.push({ cycle: index + 1, active, native, released });
  }
  expect(errors).toEqual([]);
  await testInfo.attach('rv-ten-round-trips', {
    contentType: 'application/json',
    body: JSON.stringify({ cycles, errors }, null, 2),
  });
});
