import { expect, test } from '@playwright/test';

const routes = [
  '',
  'half-bridge-module/',
  'chip-junction-temperature/',
  'rv-reducer/',
  'harmonic-drive/',
  'sample-simulation/',
];

for (const prefix of ['', '/en']) {
  for (const slug of routes) {
    test(`${prefix}/lab/${slug} loads only route fonts and nonblocking styles`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const fonts: string[] = [];
      page.on('request', (request) => {
        const pathname = new URL(request.url()).pathname;
        if (pathname.endsWith('.woff2')) fonts.push(pathname);
      });
      await page.goto(`${prefix}/lab/${slug}`);
      await page.evaluate(() => document.fonts.ready);
      expect(fonts.filter((url) => /noto-sans-sc-\d+-/.test(url))).toEqual([]);
      const screenSheets = await page
        .locator('link[rel="stylesheet"]')
        .evaluateAll((links) =>
          links
            .filter((link) => (link as HTMLLinkElement).media !== 'print')
            .map((link) => link.getAttribute('href')),
        );
      expect(screenSheets).toEqual([]);
      await expect(page.locator('[data-critical-shell]')).toHaveCount(1);
      expect(await page.locator('[data-critical-shell]').textContent()).not.toMatch(
        /noto-sans-sc-\d+-/,
      );
      if (slug === '') {
        const weights = new Set(
          fonts.flatMap((url) => url.match(/noto-sans-sc-.+?-(\d+)-normal/)?.[1] ?? []),
        );
        expect(weights.size).toBeLessThanOrEqual(2);
        expect([...weights].every((weight) => ['400', '700'].includes(weight))).toBe(true);
      }
    });
  }

  test(`${prefix} client navigation removes global fallback font CSS`, async ({ page }) => {
    await page.goto(`${prefix}/`);
    await page.locator(`a[href="${prefix}/lab/"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/lab/$`));
    await expect(page.locator('[data-critical-shell]')).toHaveCount(1);
    expect(await page.locator('[data-critical-shell]').textContent()).not.toMatch(
      /noto-sans-sc-\d+-/,
    );
    const loadedSheet = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((links) =>
        links.some((link) => /BaseLayout\.|LabDetail\./.test((link as HTMLLinkElement).href)),
      );
    expect(loadedSheet).toBe(false);
  });
}
