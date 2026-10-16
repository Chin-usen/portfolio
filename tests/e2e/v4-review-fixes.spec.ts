import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`focused skip action stays above the header at ${viewport.width} in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/');
      const skip = page.locator('.skip-link');
      await page.keyboard.press('Tab');
      await expect(skip).toBeFocused();
      expect(
        await skip.evaluate((element) => {
          const r = element.getBoundingClientRect();
          const painted = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return {
            visible: painted === element || element.contains(painted),
            top: r.top,
            bottom: r.bottom,
          };
        }),
      ).toMatchObject({ visible: true });
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
    });
  }
}

for (const prefix of ['', '/en']) {
  test(`${prefix || 'zh'} mobile S1 offers a keyboard jump to visible parameters`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${prefix}/lab/chip-junction-temperature/`);
    await page.evaluate(() => document.fonts.ready);
    const jump = page.locator('.thermal-parameter-jump');
    await expect(jump).toBeInViewport();
    expect((await jump.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await jump.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#thermal-parameters$/);
    await expect(page.locator('#thermal-parameters')).toBeFocused();
    await expect
      .poll(async () => (await page.locator('#thermal-parameters').boundingBox())!.y)
      .toBeGreaterThanOrEqual(52);
    await expect
      .poll(async () => (await page.locator('#thermal-parameters').boundingBox())!.y)
      .toBeLessThan(100);
    await expect(page.locator('.thermal-parameter-heading h2')).toBeInViewport();
  });
}
