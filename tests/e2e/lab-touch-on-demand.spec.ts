import { expect, test } from '@playwright/test';

// Touch devices keep the static poster until the visitor asks for the 3D model:
// no automatic Three/GLB download or main-thread scene build on phones.
const pages = ['half-bridge-module', 'rv-reducer', 'harmonic-drive', 'robot-joint'];

for (const prefix of ['', '/en']) {
  for (const slug of pages) {
    test(`${prefix}/lab/${slug} waits for a tap before loading WebGL on touch devices`, async ({
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
        const heavyRequests: string[] = [];
        page.on('request', (request) => {
          const path = new URL(request.url()).pathname;
          if (/\/three\.module\.|\.glb$/.test(path)) heavyRequests.push(path);
        });
        await page.goto(`${prefix}/lab/${slug}/`);
        const root = page.locator('[data-disassembly]');
        const button = root.locator('[data-l1-load]');
        await expect(button).toBeVisible();
        await expect(root).toHaveAttribute('data-load', 'manual');
        await expect(root.locator('[data-l1-preview]')).toBeVisible();
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);

        // Scrolling across the stage must not start WebGL.
        const stage = (await root.locator('[data-l1-stage]').boundingBox())!;
        await page.touchscreen.tap(stage.x + 12, stage.y + 12);
        await page.waitForTimeout(1500);
        expect(heavyRequests).toEqual([]);
        await expect(root).toHaveAttribute('data-renderer', 'loading');

        await button.tap();
        await expect(button).toBeHidden();
        await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
        await expect(root).not.toHaveAttribute('data-load', 'manual');
        expect(heavyRequests.some((path) => /\/three\.module\./.test(path))).toBe(true);
      } finally {
        await context.close();
      }
    });
  }
}

test('desktop pointers keep automatic enhancement', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/lab/rv-reducer/');
  const root = page.locator('[data-disassembly]');
  await expect(root.locator('[data-l1-load]')).toBeHidden();
  await expect(root).toHaveAttribute('data-renderer', 'webgl', { timeout: 30_000 });
});
