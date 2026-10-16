import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const route = '/lab/chip-junction-temperature/';

test('S1 chip card is visible in server HTML and eight legend entries stay balanced', async ({
  page,
}) => {
  const response = await page.request.get(route);
  const html = await response.text();
  expect(html).toMatch(/<aside[^>]*data-layer-card(?![^>]*hidden)/);
  for (const width of [1280, 1440, 1600, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('[data-layer-card]')).toBeVisible();
    await expect(page.locator('[data-select-layer="chip"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const rows = await page.locator('[data-select-layer]').evaluateAll((buttons) => {
      const rows = new Map<number, number>();
      for (const button of buttons) {
        const top = Math.round(button.getBoundingClientRect().top);
        rows.set(top, (rows.get(top) ?? 0) + 1);
      }
      return [...rows.values()];
    });
    expect(rows).toEqual([4, 4]);
  }
});

test('ten Home to S1 returns release WebGL resources and reinitialize all controls', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => Reflect.set(window, 'thermalNavigationSession', 'same-document'));
  const cycles = [];
  for (let index = 0; index < 10; index += 1) {
    await page.locator('a[href="/lab/"]').first().click();
    await expect(page).toHaveURL(/\/lab\/$/);
    await page.locator(`a[href="${route}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.locator('[data-thermal-renderer]')).toHaveAttribute(
      'data-thermal-renderer',
      'webgl',
    );
    await page.locator('[data-explode]').click();
    await expect(page.locator('[data-explode]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-param="P"]').fill('150');
    await expect(page.locator('[data-value="tj"]')).toHaveText('155.8');
    // Finish a real animation, then collect the renderer's own allocation counters.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Reflect.get(window, 'thermalStackLifecycle').snapshot().active[0].viewer
              .explodeProgress,
        ),
      )
      .toBe(1);
    const active = await page.evaluate(() =>
      Reflect.get(window, 'thermalStackLifecycle').snapshot(),
    );
    expect(active.active).toHaveLength(1);
    expect(active.active[0].viewer.rendererInfo.contextLost).toBe(false);
    expect(active.active[0].viewer.rendererInfo.geometries).toBeGreaterThan(0);
    await page.locator('.site-name').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-thermal-lab]')).toHaveCount(0);
    const released = await page.evaluate(() =>
      Reflect.get(window, 'thermalStackLifecycle').snapshot(),
    );
    const last = released.released.at(-1);
    expect(released.active).toHaveLength(0);
    expect(released.initialized).toBe(index + 1);
    expect(released.disposed).toBe(index + 1);
    expect(last.listenersAborted).toBe(true);
    expect(last.observersConnected).toBe(false);
    expect(last.calculationFrame).toBe(false);
    expect(last.viewer.disposed).toBe(true);
    expect(last.viewer.scheduledFrame).toBe(false);
    expect(last.viewer.geometryCount).toBe(0);
    expect(last.viewer.ownedListeners).toBe(0);
    expect(last.viewer.controlsDisposed).toBe(true);
    expect(last.viewer.rendererInfo.contextLost).toBe(true);
    expect(last.viewer.rendererInfo.geometries).toBe(0);
    expect(last.viewer.rendererInfo.textures).toBe(0);
    expect(last.viewer.rendererInfo.programs).toBe(0);
    expect(await page.evaluate(() => Reflect.get(window, 'thermalNavigationSession'))).toBe(
      'same-document',
    );
    cycles.push({ cycle: index + 1, active: active.active[0], released: last });
  }
  expect(errors).toEqual([]);
  const directory = path.resolve('../deliverables-v4/reports/lifecycle');
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'home-s1-ten-round-trips.json'),
    JSON.stringify(
      {
        routeSequence: 'Home → Lab → S1 → Home, ten cycles in one ClientRouter document',
        evidence:
          'Actual renderer.info allocations + isContextLost; own listeners, OrbitControls and AbortSignal cleanup; this is not a browser heap census.',
        cycles,
        errors,
      },
      null,
      2,
    ),
  );
});

test('forced SVG fallback releases layer listeners before a client route swap', async ({
  page,
}) => {
  await page.goto(`${route}?renderer=2d`);
  await expect(page.locator('[data-thermal-renderer]')).toHaveAttribute(
    'data-thermal-renderer',
    'fallback',
  );
  await page.locator('[data-select-layer="ceramic"]').click();
  await expect(page.locator('[data-select-layer="ceramic"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('.site-name').first().click();
  await expect(page.locator('[data-thermal-lab]')).toHaveCount(0);
  const lifecycle = await page.evaluate(() =>
    Reflect.get(window, 'thermalStackLifecycle').snapshot(),
  );
  expect(lifecycle.active).toHaveLength(0);
  const released = lifecycle.released.at(-1);
  expect(released.listenersAborted).toBe(true);
  expect(released.viewer.mode).toBe('fallback');
  expect(released.viewer.layerCount).toBe(0);
  expect(released.viewer.ownedListeners).toBe(0);
  expect(released.viewer.scheduledFrame).toBe(false);
});
