import { expect, test, type Locator, type Page } from '@playwright/test';

const route = '/lab/chip-junction-temperature/';

async function settledView(page: Page, canvas: Locator) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  return canvas.screenshot({ animations: 'disabled' });
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`keyboard orbit, zoom and reset change the rendered view (${reducedMotion})`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = window.requestAnimationFrame.bind(window);
      const diagnostic = { calls: 0 };
      Object.defineProperty(window, 'keyboardRafDiagnostic', { value: diagnostic });
      window.requestAnimationFrame = (callback) => {
        diagnostic.calls++;
        return original(callback);
      };
    });
    await page.emulateMedia({ reducedMotion });
    const chinese = reducedMotion === 'reduce';
    await page.goto(chinese ? route : `/en${route}`);
    await page.evaluate(() => document.fonts.ready);
    const canvas = page.locator('canvas[data-thermal-canvas="webgl"]');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute(
      'aria-label',
      chinese ? /方向键.*Home.*Tab/ : /arrow keys.*Home.*Tab/,
    );
    await expect(page.locator('.thermal-interaction-hint')).toContainText('Home');
    await canvas.scrollIntoViewIfNeeded();
    await canvas.focus();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);
    const initial = await settledView(page, canvas);
    const scrollY = await page.evaluate(() => window.scrollY);

    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-']) {
      await page.keyboard.press(key);
      expect(
        (await settledView(page, canvas)).equals(initial),
        `${key} changes the camera view`,
      ).toBe(false);
      await expect(canvas).toBeFocused();
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
      await page.keyboard.press('Home');
      expect(
        (await settledView(page, canvas)).equals(initial),
        'Home restores the original view',
      ).toBe(true);
    }

    const frameCount = () =>
      page.evaluate(() => Reflect.get(window, 'keyboardRafDiagnostic').calls as number);
    const idle = await frameCount();
    await page.waitForTimeout(300);
    expect(await frameCount()).toBe(idle);
    await page.keyboard.press('Tab');
    await expect(canvas).not.toBeFocused();
  });
}

test('keyboard zoom and polar orbit stop at their bounds and remain reversible', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(route);
  const canvas = page.locator('canvas[data-thermal-canvas="webgl"]');
  await expect(canvas).toBeVisible();
  await canvas.focus();
  await page.mouse.move(0, 0);

  for (const [key, reverse] of [
    ['+', '-'],
    ['-', '+'],
    ['ArrowUp', 'ArrowDown'],
    ['ArrowDown', 'ArrowUp'],
  ]) {
    await page.keyboard.press('Home');
    for (let repeat = 0; repeat < 40; repeat++) await page.keyboard.press(key!);
    const atLimit = await settledView(page, canvas);
    await page.keyboard.press(key!);
    expect(
      (await settledView(page, canvas)).equals(atLimit),
      `${key} stops at the camera bound`,
    ).toBe(true);
    await page.keyboard.press(reverse!);
    expect(
      (await settledView(page, canvas)).equals(atLimit),
      `${reverse} moves away from the bound`,
    ).toBe(false);
  }
});
