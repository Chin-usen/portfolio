import { expect, test } from '@playwright/test';

for (const prefix of ['', '/en']) {
  for (const slug of ['half-bridge-module', 'rv-reducer', 'harmonic-drive']) {
    test(`${prefix}/${slug} reserves its preview before image decoding`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      let releaseImage!: () => void;
      const imageGate = new Promise<void>((resolve) => {
        releaseImage = resolve;
      });
      await page.route(/-exploded(?:-640)?\.webp(?:\?|$)/, async (route) => {
        await imageGate;
        await route.continue();
      });
      try {
        await page.goto(`${prefix}/lab/${slug}/`, { waitUntil: 'domcontentloaded' });
        const root = page.locator('[data-disassembly]');
        await expect(root).toHaveAttribute('data-renderer', 'fallback');
        await page.evaluate(() => document.fonts.ready);
        const image = root.locator('[data-l1-preview]');
        await expect(image).toBeVisible();
        const before = await image.boundingBox();
        expect(before).not.toBeNull();
        expect(before!.width).toBeGreaterThan(0);
        expect(before!.height).toBeGreaterThan(0);
        expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(0);
        const dimensions = await image.evaluate((element: HTMLImageElement) => ({
          width: element.getAttribute('width'),
          height: element.getAttribute('height'),
          aspectRatio: getComputedStyle(element).aspectRatio,
        }));
        expect(Number(dimensions.width)).toBeGreaterThan(0);
        expect(Number(dimensions.height)).toBeGreaterThan(0);
        expect(dimensions.aspectRatio).not.toBe('auto');
        releaseImage();
        await expect
          .poll(() =>
            image.evaluate(
              (element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
            ),
          )
          .toBe(true);
        const after = await image.boundingBox();
        for (const key of ['x', 'y', 'width', 'height'] as const)
          expect(after![key]).toBeCloseTo(before![key], 3);
        const modes = await root.locator('[data-l1-mode]').evaluateAll((buttons) =>
          buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            return { top: rect.top, width: rect.width, height: rect.height };
          }),
        );
        expect(
          Math.max(...modes.map((rect) => rect.top)) - Math.min(...modes.map((rect) => rect.top)),
        ).toBeLessThan(1);
        expect(modes.every((rect) => rect.width > 0 && rect.height >= 44)).toBe(true);
        if (prefix === '') {
          await expect(root.locator('.l1-back')).toContainText('返回实验台');
          await expect(root.locator('.l1-info dt')).toHaveText(['作用', '特点', '常用材料']);
          await expect(root.locator('.l1-kicker')).toHaveText(/L\d · 3D 拆解/);
        }
        if (slug === 'harmonic-drive') {
          await expect(root.locator('[data-hd-ratio]')).toHaveText('−100');
          await expect(root.locator('[data-l1-material]')).not.toContainText(/占位|placeholder/i);
        }
      } finally {
        releaseImage();
      }
    });
  }
}
