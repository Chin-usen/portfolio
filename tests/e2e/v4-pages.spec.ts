import { expect, test } from '@playwright/test';

const locales = ['', '/en'];
const themes = ['light', 'dark'] as const;
const homeViewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 390, height: 667 },
];

for (const prefix of locales) {
  for (const viewport of homeViewports) {
    test(`${prefix || 'zh'} N1 Home fits ${viewport.width}x${viewport.height} in both themes without clipping`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      for (const theme of themes) {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto(`${prefix}/`);
        await page.evaluate(() => document.fonts.ready);
        const image = page.locator('.home-module img');
        await expect(image).toBeVisible();
        await expect
          .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
          .toBeGreaterThan(0);
        expect(await image.evaluate((element: HTMLImageElement) => element.currentSrc)).toContain(
          `power-module-${theme}-`,
        );
        await expect(page.locator('main > *')).toHaveCount(2);
        await expect(
          page.locator(
            'main .home-metrics, main .home-lab, main .work-metrics, main input, main canvas',
          ),
        ).toHaveCount(0);
        const geometry = await page.evaluate(() => {
          const box = (selector: string) => {
            const rect = document.querySelector(selector)!.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
          };
          return {
            viewport: innerHeight,
            documentHeight: document.documentElement.scrollHeight,
            bodyHeight: document.body.scrollHeight,
            width: document.documentElement.scrollWidth,
            overflow: [
              getComputedStyle(document.documentElement).overflowY,
              getComputedStyle(document.body).overflowY,
            ],
            header: box('.site-header'),
            hero: box('.home-hero'),
            model: box('.home-module img'),
            footer: box('.site-footer'),
          };
        });
        expect(geometry.documentHeight).toBeLessThanOrEqual(viewport.height);
        expect(geometry.bodyHeight).toBeLessThanOrEqual(viewport.height);
        expect(geometry.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(geometry.overflow).not.toContain('hidden');
        expect(geometry.overflow).not.toContain('clip');
        expect(geometry.header.top).toBe(0);
        expect(geometry.header.height).toBe(52);
        expect(geometry.header.bottom).toBeLessThanOrEqual(geometry.hero.top);
        expect(geometry.hero.bottom).toBeLessThanOrEqual(geometry.model.top + 1);
        expect(geometry.model.height).toBeGreaterThan(0);
        expect(geometry.model.bottom).toBeLessThanOrEqual(geometry.footer.top + 1);
        expect(geometry.footer.bottom).toBeLessThanOrEqual(geometry.viewport);
      }
    });
  }

  test(`${prefix || 'zh'} short landscape Home allows scrolling while retaining its complete content`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(`${prefix}/`);
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const hero = document.querySelector('.home-hero')!.getBoundingClientRect();
      const image = document.querySelector('.home-module img')!.getBoundingClientRect();
      const footer = document.querySelector('.site-footer')!.getBoundingClientRect();
      return {
        heroBottom: hero.bottom,
        imageTop: image.top,
        imageBottom: image.bottom,
        imageHeight: image.height,
        footerTop: footer.top,
        width: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.width).toBeLessThanOrEqual(845);
    expect(geometry.imageHeight).toBeGreaterThan(0);
    expect(geometry.heroBottom).toBeLessThanOrEqual(geometry.imageTop + 1);
    expect(geometry.imageBottom).toBeLessThanOrEqual(geometry.footerTop + 1);
    await page.locator('.footer-links a').first().scrollIntoViewIfNeeded();
    await expect(page.locator('.footer-links a').first()).toBeInViewport();
  });

  test(`${prefix || 'zh'} Work owns the black metric band and all three linked career cases`, async ({
    page,
  }) => {
    for (const theme of themes) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`${prefix}/work/`);
      const band = page.locator('.work-metrics');
      await expect(band).toBeVisible();
      const style = await band.evaluate((element) => {
        const css = getComputedStyle(element);
        return {
          background: css.backgroundColor,
          topWidth: css.borderTopWidth,
          bottomWidth: css.borderBottomWidth,
          topColor: css.borderTopColor,
          bottomColor: css.borderBottomColor,
        };
      });
      expect(style.background).toBe('rgb(0, 0, 0)');
      if (theme === 'dark') {
        expect(style.topWidth).toBe('1px');
        expect(style.bottomWidth).toBe('1px');
        expect(style.topColor).toBe('rgba(255, 255, 255, 0.08)');
        expect(style.bottomColor).toBe('rgba(255, 255, 255, 0.08)');
      }
      await expect(band.locator('.work-secondary-metrics > div')).toHaveCount(3);
      await expect(band.locator('.work-main-metric')).toContainText('00');
      const rows = page.locator('a.work-row');
      await expect(rows).toHaveCount(3);
      expect(
        await rows.evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('href')),
        ),
      ).toEqual([
        `${prefix}/work/sample-case/`,
        `${prefix}/work/career-case-b/`,
        `${prefix}/work/career-case-c/`,
      ]);
      for (const row of await rows.all()) {
        await expect(row.locator('h2')).toHaveText(/\[[^\]]+\]/);
        await expect(row.locator('.work-row-copy p')).not.toBeEmpty();
        await expect(row.locator('.work-row-metric')).toContainText('00');
      }
    }
    for (let index = 0; index < 3; index++) {
      await page.goto(`${prefix}/work/`);
      const row = page.locator('a.work-row').nth(index);
      const href = await row.getAttribute('href');
      const title = await row.locator('h2').innerText();
      await row.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.locator('main h1')).toHaveText(title);
      await expect(page.locator('main .prose')).toBeVisible();
    }
  });

  test(`${prefix || 'zh'} Lab retains every available experiment and distinguishes all three planned previews`, async ({
    page,
    request,
  }) => {
    await page.goto(`${prefix}/lab/`);
    const available = page.locator('.lab-available .content-card');
    await expect(available).toHaveCount(3);
    const hrefs = await available
      .locator('h2 a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')!).sort());
    expect(hrefs).toEqual([
      `${prefix}/lab/chip-junction-temperature/`,
      `${prefix}/lab/sample-simulation/`,
      `${prefix}/lab/sample-teardown/`,
    ]);
    for (const href of hrefs) expect((await request.get(href)).status()).toBe(200);
    const planned = page.locator('.lab-planned .lab-planned-card');
    await expect(planned).toHaveCount(3);
    await expect(planned.locator('a, button')).toHaveCount(0);
    for (const card of await planned.all()) {
      await expect(card.locator('h3')).not.toBeEmpty();
      await expect(card.locator('.lab-card-subtitle')).not.toBeEmpty();
      await expect(card.locator('.lab-card-status')).toContainText(
        /Not implemented|\u5c1a\u672a\u5b9e\u73b0/,
      );
    }
    expect(new Set(await planned.locator('h3').allTextContents()).size).toBe(3);
  });

  test(`${prefix || 'zh'} legacy Contact resolves to the accessible About contact section`, async ({
    page,
  }) => {
    await page.goto(`${prefix}/contact/`);
    await expect(page).toHaveURL(new RegExp(`${prefix}/about/#contact$`));
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('#contact')).toBeInViewport();
    await expect(page.locator('#contact [data-testid="email-reveal"]')).toBeVisible();
    await expect(page.locator('.footer-links a')).toHaveCount(2);
    const linkedIn = await page.locator('#contact a[rel~="me"]').getAttribute('href');
    expect(linkedIn).toMatch(/^https:\/\/www\.linkedin\.com\//);
    await expect(page.locator('.footer-links a').first()).toHaveAttribute(
      'href',
      `${prefix}/about/#contact`,
    );
    await expect(page.locator('.footer-links a').nth(1)).toHaveAttribute('href', linkedIn!);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('menu-toggle').click();
    await expect(page.locator('.n1-menu-contact a').first()).toHaveAttribute(
      'href',
      `${prefix}/about/#contact`,
    );
    await expect(page.locator('.n1-menu-contact a').nth(1)).toHaveAttribute('href', linkedIn!);
    await page.locator('.n1-menu-contact a').first().click();
    await expect(page.locator('#mobile-menu')).not.toHaveAttribute('open', '');
    await expect(page.locator('#contact')).toBeInViewport();
  });

  test(`${prefix || 'zh'} Home, Work and About render readable content without replacement characters`, async ({
    page,
  }) => {
    for (const route of [
      '/',
      '/work/',
      '/work/sample-case/',
      '/work/career-case-b/',
      '/work/career-case-c/',
      '/about/',
      '/lab/',
    ]) {
      await page.goto(`${prefix}${route}`);
      expect(await page.locator('main').innerText(), route).not.toMatch(/\uFFFD|\?{2,}/);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description, route).not.toMatch(/\uFFFD|\?{2,}/);
    }
  });
}
