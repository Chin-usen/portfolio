import { expect, test } from '@playwright/test';

// Keep the v3 progressive-enhancement regression coverage after N1 removes the Home demo.
for (const prefix of ['', '/en']) {
  test(`${prefix || 'zh'} Home retains its static WebP and section links without WebGL`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: string,
        ...args: unknown[]
      ) {
        if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null;
        return Reflect.apply(original, this, [kind, ...args]);
      } as typeof original;
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${prefix}/`);
    const image = page.locator('.home-module img');
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
    expect(await image.evaluate((element: HTMLImageElement) => element.currentSrc)).toMatch(
      /\.webp$/,
    );
    await expect(page.locator('main canvas, main input[type="range"]')).toHaveCount(0);
    const actions = page.locator('.home-actions a');
    await expect(actions).toHaveCount(2);
    await expect(actions.nth(0)).toHaveAttribute('href', `${prefix}/work/`);
    await expect(actions.nth(1)).toHaveAttribute('href', `${prefix}/lab/`);
    await actions.nth(1).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/lab/$`));
    await expect(page.locator('main h1')).toBeVisible();
  });

  test(`${prefix || 'zh'} Home retains its illustration and section navigation without JavaScript`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4322${prefix}/`);
    const image = page.locator('.home-module img');
    await expect(image).toBeVisible();
    expect(
      await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
    ).toBeGreaterThan(0);
    const links = page.getByTestId('desktop-nav').locator('a');
    await expect(links).toHaveCount(3);
    for (const link of await links.all()) await expect(link).toBeVisible();
    await expect(page.getByTestId('menu-toggle')).toBeHidden();
    await page.locator(`.home-actions a[href="${prefix}/work/"]`).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/work/$`));
    await expect(page.locator('.work-row')).toHaveCount(3);
    await context.close();
  });

  test(`${prefix || 'zh'} Home remains usable with 200 percent mobile text in both themes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(`${prefix}/`);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      await page.getByTestId('menu-toggle').click();
      await expect(page.getByTestId('menu-close')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('menu-toggle')).toBeFocused();
      const geometry = await page.evaluate(() => {
        const selectors = ['.site-header', '.home-hero', '.home-module', '.site-footer'];
        return {
          width: document.documentElement.scrollWidth,
          blocks: selectors.map((selector) => {
            const box = document.querySelector(selector)!.getBoundingClientRect();
            return { selector, top: box.top, bottom: box.bottom, height: box.height };
          }),
        };
      });
      expect(geometry.width).toBeLessThanOrEqual(391);
      for (const block of geometry.blocks) {
        expect(block.height, JSON.stringify(geometry)).toBeGreaterThan(0);
      }
      for (let index = 1; index < geometry.blocks.length; index++) {
        expect(geometry.blocks[index - 1]!.bottom).toBeLessThanOrEqual(
          geometry.blocks[index]!.top + 1,
        );
      }
      for (const link of await page.locator('.home-actions a, .footer-links a').all()) {
        const box = await link.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
}
