import { expect, test } from '@playwright/test';

const sitePages = [
  '/',
  '/work/',
  '/lab/',
  '/about/',
  '/contact/',
  '/lab/chip-junction-temperature/',
];
const thermal = '/lab/chip-junction-temperature/';

test('N1 shell and D1 experiment retain both themes across all 48 review states', async ({
  page,
}) => {
  for (const locale of ['', '/en'])
    for (const width of [1440, 390])
      for (const theme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        for (const route of sitePages) {
          await page.goto(`${locale}${route}`);
          if (route === '/contact/') {
            await expect(page).toHaveURL(new RegExp(`${locale}/about/#contact$`));
          }
          await page.evaluate(() => document.fonts.ready);
          const state = await page.evaluate(() => ({
            background: getComputedStyle(document.body).backgroundColor,
            family: getComputedStyle(document.body).fontFamily,
            width: document.documentElement.scrollWidth,
          }));
          expect(state.width).toBeLessThanOrEqual(width + 1);
          expect(state.family).toContain('Geist');
          expect(state.background).toBe(
            theme === 'dark' ? 'rgb(14, 14, 16)' : 'rgb(251, 251, 253)',
          );
        }
      }
});

test('mobile result and threshold remain visible at the controls, with selected tab in view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const prefix of ['', '/en']) {
    await page.goto(`${prefix}${thermal}`);
    const first = page.locator('[data-tab="operating"]');
    await first.focus();
    await page.keyboard.press('End');
    const cooler = page.locator('[data-tab="cooler"]');
    await expect(cooler).toHaveAttribute('aria-selected', 'true');
    const tabBox = await cooler.boundingBox();
    const strip = await page.locator('.thermal-tabs').boundingBox();
    expect(tabBox!.x).toBeGreaterThanOrEqual(strip!.x - 1);
    expect(tabBox!.x + tabBox!.width).toBeLessThanOrEqual(strip!.x + strip!.width + 1);
    await first.click();
    const power = page.locator('[data-param="P"]');
    await power.focus();
    await page.keyboard.press('End');
    await expect(page.locator('[data-control-tj]')).toHaveText('367.8');
    await power.scrollIntoViewIfNeeded();
    const summary = await page.locator('[data-control-summary]').boundingBox();
    expect(summary!.y).toBeGreaterThanOrEqual(-1);
    expect(summary!.y + summary!.height).toBeLessThan(844);
    await expect(page.locator('[data-control-warning]')).toBeVisible();
    await expect(page.locator('[data-result-live]')).toContainText('175');
    const selected = page.locator('[data-tab="amb"]');
    await selected.click();
    await page.locator('[data-material-value="24"]').click();
    await expect(page.locator('[data-material-value="24"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const active = await page.locator('[data-material-value="24"]').evaluate((el) => ({
      color: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
      expectedBackground: getComputedStyle(document.querySelector('.thermal-lab')!).color,
      expectedForeground: getComputedStyle(document.querySelector('.thermal-stage')!)
        .backgroundColor,
    }));
    expect(active.color).toBe(active.expectedForeground);
    expect(active.background).toBe(active.expectedBackground);
  }
});

test('200 percent text has nonoverlapping mobile metrics, actions and model', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const prefix of ['', '/en']) {
    await page.goto(`${prefix}${thermal}`);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const geometry = await page.evaluate(() => {
      const box = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      return {
        metrics: box('.thermal-metrics'),
        actions: box('.thermal-view-actions'),
        canvas: box('.thermal-canvas'),
        scale: box('.thermal-scale'),
        width: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.metrics.bottom).toBeLessThanOrEqual(geometry.actions.top + 1);
    expect(geometry.actions.bottom).toBeLessThanOrEqual(geometry.canvas.top + 1);
    expect(geometry.canvas.bottom).toBeLessThanOrEqual(geometry.scale.top + 1);
    expect(geometry.width).toBeLessThanOrEqual(391);
  }
});

test('D1 skip link and technical labels keep readable theme pairs and minimum sizes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(thermal);
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  const colors = await skip.evaluate((el) => ({
    color: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor,
  }));
  expect(colors).toEqual({ color: 'rgb(245, 245, 247)', background: 'rgb(22, 22, 23)' });
  const smallest = await page
    .locator(
      '.thermal-node-label, .thermal-scale p, .thermal-range-labels, .thermal-legend-value, .thermal-model-notes',
    )
    .evaluateAll((elements) =>
      Math.min(...elements.map((el) => parseFloat(getComputedStyle(el).fontSize))),
    );
  expect(smallest).toBeGreaterThanOrEqual(12);
  const heights = await page
    .locator('button:visible, input[type="range"]:visible, .n1-language:visible')
    .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
});

test('desktop edits keep the current result and warning in the visible parameter area', async ({
  page,
}) => {
  for (const prefix of ['', '/en']) {
    for (const height of [688, 1000]) {
      await page.setViewportSize({ width: 1440, height });
      await page.goto(`${prefix}${thermal}`);
      const power = page.locator('[data-param="P"]');
      await power.focus();
      await page.keyboard.press('End');
      await expect(page.locator('[data-control-tj]')).toHaveText('367.8');
      const summary = await page.locator('[data-control-summary]').boundingBox();
      expect(summary!.y).toBeGreaterThanOrEqual(-1);
      expect(summary!.y + summary!.height).toBeLessThan(height);
      await expect(page.locator('[data-control-warning]')).toBeVisible();
      const input = await power.boundingBox();
      expect(input!.y).toBeGreaterThanOrEqual(summary!.y + summary!.height);
    }
  }
});

test('enlarged scientific numbers never split internally or overflow the page', async ({
  page,
}) => {
  for (const prefix of ['', '/en']) {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${prefix}${thermal}`);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      for (const tab of ['operating', 'cooler']) {
        await page.locator(`[data-tab="${tab}"]`).click();
        const lines = await page.locator('output:visible').evaluateAll((outputs) =>
          outputs.map((output) => {
            const range = document.createRange();
            range.selectNodeContents(output);
            return new Set(
              [...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)),
            ).size;
          }),
        );
        expect(Math.max(...lines)).toBe(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width + 1,
        );
      }
    }
  }
});

test('standalone card and contact links provide comfortable mobile targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const prefix of ['', '/en']) {
    for (const route of ['/', '/work/', '/lab/', '/about/', '/contact/']) {
      await page.goto(`${prefix}${route}`);
      if (route === '/contact/') {
        await expect(page).toHaveURL(new RegExp(`${prefix}/about/#contact$`));
      }
      const sizes = await page
        .locator(
          '.content-card h2 a, .content-card h3 a, .meta-list dd > a, .home-actions a, .work-row',
        )
        .evaluateAll((links) =>
          links.map((link) => ({
            width: link.getBoundingClientRect().width,
            height: link.getBoundingClientRect().height,
          })),
        );
      expect(sizes.length).toBeGreaterThan(0);
      for (const size of sizes) {
        expect(size.height).toBeGreaterThanOrEqual(44);
        expect(size.width).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

test('desktop enlarged metrics, temperature scale and selected layer remain separate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const prefix of ['', '/en']) {
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(`${prefix}${thermal}`);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      await page.locator('[data-select-layer="ceramic"]').click();
      for (const hot of [false, true]) {
        if (hot) {
          await page.locator('[data-tab="operating"]').click();
          await page.locator('[data-param="P"]').focus();
          await page.keyboard.press('End');
          await expect(page.locator('[data-control-tj]')).toHaveText('367.8');
        }
        const boxes = await page.evaluate(() => {
          const box = (selector: string) => {
            const r = document.querySelector(selector)!.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
          };
          return {
            metrics: box('.thermal-metrics'),
            scale: box('.thermal-scale'),
            stage: box('.thermal-stage'),
            canvas: box('.thermal-canvas'),
            parameters: box('.thermal-parameters'),
            actions: box('.thermal-view-actions'),
            card: box('.thermal-layer-card'),
            hint: box('.thermal-interaction-hint'),
          };
        });
        expect(boxes.metrics.bottom).toBeLessThanOrEqual(boxes.stage.top);
        expect(boxes.metrics.bottom).toBeLessThanOrEqual(boxes.parameters.top);
        expect(boxes.stage.right).toBeLessThanOrEqual(boxes.parameters.left);
        expect(boxes.actions.bottom).toBeLessThanOrEqual(boxes.canvas.top);
        expect(boxes.canvas.bottom).toBeLessThanOrEqual(boxes.card.top);
        expect(boxes.card.bottom).toBeLessThanOrEqual(boxes.scale.top);
        expect(boxes.scale.bottom).toBeLessThanOrEqual(boxes.hint.top);
        expect(boxes.hint.bottom).toBeLessThanOrEqual(boxes.stage.bottom);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          1441,
        );
      }
    }
  }
});
