import { expect, test } from '@playwright/test';

for (const prefix of ['', '/en']) {
  for (const slug of ['sample-case', 'career-case-b', 'career-case-c']) {
    test(`${prefix}/work/${slug} uses scoped fonts for content and the mobile menu`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const fonts: string[] = [];
      page.on('request', (request) => {
        const pathname = new URL(request.url()).pathname;
        if (pathname.endsWith('.woff2')) fonts.push(pathname);
      });
      await page.goto(`${prefix}/work/${slug}/`);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.locator('h1').evaluate((element) => getComputedStyle(element).fontWeight),
      ).toBe('700');
      await page.getByTestId('menu-toggle').click();
      await expect(page.locator('#mobile-menu')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const noto = fonts.filter((url) => url.includes('noto-sans-sc'));
      expect(noto.length).toBeGreaterThan(0);
      expect(
        noto.every((url) =>
          /^\/fonts\/work-detail\/noto-sans-sc-work-detail-(400|500|600|700)-normal\.woff2$/.test(
            url,
          ),
        ),
      ).toBe(true);
      expect(
        await page.locator('body').evaluate((element) => getComputedStyle(element).fontFamily),
      ).toContain('Noto Sans SC Work Detail');
      expect(await page.locator('[data-critical-shell]').textContent()).not.toMatch(
        /noto-sans-sc-(common|content|\d+)-/,
      );
      await page.getByTestId('menu-close').click();
    });
  }
}
