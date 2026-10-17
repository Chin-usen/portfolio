import { expect, test } from '@playwright/test';

const pages = ['half-bridge-module', 'chip-junction-temperature', 'rv-reducer', 'harmonic-drive'];
for (const prefix of ['', '/en']) {
  for (const slug of pages) {
    test(`${prefix}/lab/${slug} paints content before its automatic Three request`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto(`${prefix}/lab/${slug}/`);
      const ready =
        slug === 'chip-junction-temperature'
          ? page.locator('[data-thermal-renderer="webgl"]')
          : page.locator('[data-disassembly][data-renderer="webgl"]');
      await expect(ready).toHaveCount(1, { timeout: 30_000 });
      const timing = await page.evaluate(() => {
        const paint = performance.getEntriesByName('first-contentful-paint')[0];
        const three = performance
          .getEntriesByType('resource')
          .find((entry) => /\/three\.module\.[^/]+\.js$/.test(new URL(entry.name).pathname));
        return { paint: paint?.startTime ?? null, three: three?.startTime ?? null };
      });
      expect(timing.paint).not.toBeNull();
      expect(timing.three).not.toBeNull();
      expect(timing.three!).toBeGreaterThan(timing.paint!);
    });
  }
}

test('a delayed poster remains ahead of automatic WebGL while the readable page paints', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/images/l1/half-bridge-exploded-*.webp', async (route) => {
    await gate;
    await route.continue();
  });
  const threeRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/three\.module\./.test(request.url())) threeRequests.push(request.url());
  });
  try {
    await page.goto('/lab/half-bridge-module/', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(() =>
        page.evaluate(() => performance.getEntriesByName('first-contentful-paint').length),
      )
      .toBe(1);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    expect(threeRequests).toEqual([]);
  } finally {
    release();
  }
  await expect(page.locator('[data-disassembly][data-renderer="webgl"]')).toHaveCount(1, {
    timeout: 30_000,
  });
  expect(threeRequests).toHaveLength(1);
});
