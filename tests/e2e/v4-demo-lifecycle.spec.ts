import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const simulation = '/lab/sample-simulation/';
const threeChunk = /\/_astro\/three\.module\.[^/]+\.js$/;

interface DemoSnapshot {
  contextsCreated: number;
  contextsLive: number;
  observedStages: number;
  pendingFrames: number;
}

// Test-only probes retain their records deliberately; they measure resource cleanup,
// not the browser's heap or garbage collection.
async function observeDemoResources(page: Page) {
  await page.addInitScript(() => {
    const contexts: WebGLRenderingContext[] = [];
    const observedStages = new Set<Element>();
    const pendingFrames = new Set<number>();
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = new Proxy(getContext, {
      apply(target, receiver, args) {
        const result = Reflect.apply(target, receiver, args);
        if ((args[0] === 'webgl' || args[0] === 'webgl2') && result && !contexts.includes(result)) {
          contexts.push(result);
        }
        return result;
      },
    });
    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends NativeResizeObserver {
      private stages = new Set<Element>();
      observe(target: Element, options?: ResizeObserverOptions) {
        super.observe(target, options);
        if (target.matches('[data-testid="demo-stage"]')) {
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
    Reflect.set(window, 'demoResourceSnapshot', () => ({
      contextsCreated: contexts.length,
      contextsLive: contexts.filter((context) => !context.isContextLost()).length,
      observedStages: observedStages.size,
      pendingFrames: pendingFrames.size,
    }));
  });
}

async function snapshot(page: Page): Promise<DemoSnapshot> {
  return page.evaluate(() => Reflect.get(window, 'demoResourceSnapshot')());
}

test('five client-route demo visits release contexts, observers, frames and old listeners', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await observeDemoResources(page);
  await page.goto('/');
  await page.evaluate(() => Reflect.set(window, 'demoRouteSession', 'same-document'));
  const cycles = [];
  for (let index = 0; index < 5; index += 1) {
    await page.locator('a[href="/lab/"]').first().click();
    await expect(page).toHaveURL(/\/lab\/$/);
    await page
      .locator('a[href="' + simulation + '"]')
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(simulation + '$'));
    const oldButton = await page.locator('[data-demo="three"]').elementHandle();
    await page.locator('[data-demo="three"]').click();
    await expect(page.getByTestId('demo-stage').locator('canvas')).toBeVisible();
    const active = await snapshot(page);
    expect(active.contextsCreated).toBe(index + 1);
    expect(active.contextsLive).toBe(1);
    expect(active.observedStages).toBe(1);

    await page.locator('.site-name').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('lazy-demos')).toHaveCount(0);
    await expect.poll(async () => (await snapshot(page)).contextsLive).toBe(0);
    await expect.poll(async () => (await snapshot(page)).pendingFrames).toBe(0);
    const released = await snapshot(page);
    expect(released.observedStages).toBe(0);
    // A retained detached button must no longer have its click handler.
    await oldButton!.evaluate(async (button) => {
      (button as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((await snapshot(page)).contextsCreated).toBe(index + 1);
    expect(await page.evaluate(() => Reflect.get(window, 'demoRouteSession'))).toBe(
      'same-document',
    );
    cycles.push({ cycle: index + 1, active, released });
    await oldButton!.dispose();
  }
  expect(errors).toEqual([]);
  const directory = path.resolve('../deliverables-v5/reports/lifecycle');
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'demo-five-round-trips.json'),
    JSON.stringify(
      {
        evidence:
          'Test-only native context, ResizeObserver and RAF probes; detached button check verifies listener removal. Records are intentionally retained and are not a heap census.',
        cycles,
        errors,
      },
      null,
      2,
    ),
  );
});

for (const interruption of ['reset', 'navigation'] as const) {
  test(
    'a ' + interruption + ' during the lazy Three import creates no WebGL context',
    async ({ page }) => {
      await observeDemoResources(page);
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let reportRequest!: (url: string) => void;
      const requested = new Promise<string>((resolve) => {
        reportRequest = resolve;
      });
      await page.route(threeChunk, async (route) => {
        reportRequest(route.request().url());
        await held;
        await route.continue();
      });
      try {
        await page.goto(simulation);
        await page.locator('[data-demo="three"]').click();
        const moduleUrl = await requested;
        // This assertion also fails if a context is allocated before the pending import.
        expect((await snapshot(page)).contextsCreated).toBe(0);
        if (interruption === 'reset') {
          await page.locator('[data-demo-reset]').click();
          await expect(page.getByTestId('demo-stage')).toBeEmpty();
          await expect(page.getByTestId('demo-status')).toBeEmpty();
        } else {
          await page.locator('.site-name').first().click();
          await expect(page).toHaveURL(/\/$/);
          await expect(page.locator('lazy-demos')).toHaveCount(0);
        }
        release();
        // Join the actual pending module, then let its stale initializer finish.
        await page.evaluate(async (url) => {
          await import(url);
          await Promise.resolve();
          await Promise.resolve();
        }, moduleUrl);
        expect((await snapshot(page)).contextsCreated).toBe(0);
        expect((await snapshot(page)).observedStages).toBe(0);
        if (interruption === 'reset') {
          await expect(page.getByTestId('demo-stage')).toBeEmpty();
          await expect(page.locator('[data-demo="three"]')).toBeEnabled();
        }
      } finally {
        release();
      }
    },
  );
}

test('a failed lazy Three import reports its error without allocating a context', async ({
  page,
}) => {
  await observeDemoResources(page);
  await page.route(threeChunk, (route) => route.abort('failed'));
  await page.goto(simulation);
  const labels = JSON.parse((await page.locator('lazy-demos').getAttribute('data-labels'))!);
  await page.locator('[data-demo="three"]').click();
  await expect(page.getByTestId('demo-status')).toHaveText(labels.error);
  await expect(page.getByTestId('demo-stage')).toBeEmpty();
  await expect(page.locator('[data-demo="three"]')).toBeEnabled();
  expect((await snapshot(page)).contextsCreated).toBe(0);
  expect((await snapshot(page)).observedStages).toBe(0);
});
