import { expect, test, type Page } from '@playwright/test';

const locales = ['', '/en'];
const themes = ['light', 'dark'] as const;
const sectionRoutes = [
  { path: '/', active: undefined },
  { path: '/work/', active: '/work/' },
  { path: '/work/sample-case/', active: '/work/' },
  { path: '/work/career-case-b/', active: '/work/' },
  { path: '/work/career-case-c/', active: '/work/' },
  { path: '/lab/', active: '/lab/' },
  { path: '/lab/half-bridge-module/', active: '/lab/' },
  { path: '/lab/sample-simulation/', active: '/lab/' },
  { path: '/lab/chip-junction-temperature/', active: '/lab/' },
  { path: '/about/', active: '/about/' },
];

async function twoFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

for (const prefix of locales) {
  for (const theme of themes) {
    test(`${prefix || 'zh'} ${theme} three-section navigation identifies index and descendant pages`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const { path, active } of sectionRoutes) {
        await page.goto(`${prefix}${path}`);
        const desktop = page.getByTestId('desktop-nav');
        await expect(desktop).toBeVisible();
        await expect(desktop.locator('a')).toHaveCount(3);
        expect(
          await desktop
            .locator('a')
            .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
        ).toEqual([`${prefix}/work/`, `${prefix}/lab/`, `${prefix}/about/`]);
        const current = desktop.locator('[aria-current="page"]');
        await expect(current).toHaveCount(active ? 1 : 0);
        if (active) await expect(current).toHaveAttribute('href', `${prefix}${active}`);
        const mobileCurrent = page.getByTestId('primary-nav').locator('[aria-current="page"]');
        await expect(mobileCurrent).toHaveCount(active ? 1 : 0);
        if (active) await expect(mobileCurrent).toHaveAttribute('href', `${prefix}${active}`);
        await expect(page.getByTestId('menu-toggle')).toBeHidden();
        await expect(page.getByTestId('language-switch')).toBeVisible();
      }
    });

    test(`${prefix || 'zh'} ${theme} native mobile dialog contains focus, locks scrolling and restores the menu button`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(`${prefix}/work/`);
      await page.evaluate(() => scrollTo(0, 300));
      const before = await page.evaluate(() => ({
        y: scrollY,
        bodyOverflow: document.body.style.overflow,
        htmlOverflow: document.documentElement.style.overflow,
      }));
      const toggle = page.getByTestId('menu-toggle');
      await toggle.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByTestId('menu-close')).toBeFocused();
      const box = await dialog.boundingBox();
      expect(box).toEqual({ x: 0, y: 0, width: 390, height: 844 });
      await expect(page.getByTestId('primary-nav').locator('a')).toHaveCount(3);
      await expect(
        page.getByTestId('primary-nav').locator('[aria-current="page"]'),
      ).toHaveAttribute('href', `${prefix}/work/`);
      await expect(dialog.locator('.n1-current-dot')).toHaveCount(1);
      const dotColor = await dialog
        .locator('.n1-current-dot')
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(dotColor).toBe(theme === 'dark' ? 'rgb(255, 159, 90)' : 'rgb(191, 72, 0)');
      const targets = await dialog.locator('a, button').evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
      );
      for (const target of targets) {
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }
      for (let index = 0; index < targets.length + 2; index++) {
        await page.keyboard.press('Tab');
        const active = await dialog.evaluate((element) => ({
          inside: element.contains(document.activeElement),
          tag: document.activeElement?.tagName,
          href: document.activeElement?.getAttribute('href'),
          testId: document.activeElement?.getAttribute('data-testid'),
        }));
        expect(
          active.inside,
          `Tab ${index + 1} stays in the modal: ${JSON.stringify(active)}`,
        ).toBe(true);
      }
      for (let index = 0; index < targets.length + 2; index++) {
        await page.keyboard.press('Shift+Tab');
        expect(
          await dialog.evaluate((element) => element.contains(document.activeElement)),
          `Shift+Tab ${index + 1} stays in the modal`,
        ).toBe(true);
      }
      await page.mouse.move(360, 400);
      await page.mouse.wheel(0, 900);
      await twoFrames(page);
      expect(
        await page.evaluate(() => ({
          y: scrollY,
          bodyOverflow: document.body.style.overflow,
          htmlOverflow: document.documentElement.style.overflow,
        })),
      ).toEqual({ y: before.y, bodyOverflow: 'hidden', htmlOverflow: 'hidden' });
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(
        await page.evaluate(() => ({
          y: scrollY,
          bodyOverflow: document.body.style.overflow,
          htmlOverflow: document.documentElement.style.overflow,
        })),
      ).toEqual(before);
      await toggle.click();
      await page.getByTestId('menu-close').click();
      await expect(dialog).toBeHidden();
      await expect(toggle).toBeFocused();
      await toggle.click();
      await page.getByTestId('primary-nav').locator(`a[href="${prefix}/about/"]`).click();
      await expect(page).toHaveURL(new RegExp(`${prefix}/about/$`));
      await expect(page.locator('#mobile-menu')).toBeHidden();
      await expect(page.locator('main h1')).toBeFocused();
      expect(await page.evaluate(() => getComputedStyle(document.body).overflowY)).not.toBe(
        'hidden',
      );
    });
  }

  test(`${prefix || 'zh'} mobile navigation switches at exactly 768px and releases an open modal`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 767, height: 900 });
    await page.goto(`${prefix}/lab/`);
    const toggle = page.getByTestId('menu-toggle');
    const desktop = page.getByTestId('desktop-nav');
    await expect(toggle).toBeVisible();
    await expect(desktop).toBeHidden();
    await toggle.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.locator('#mobile-menu')).toBeHidden();
    await expect(toggle).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(desktop).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflowY)).not.toBe('hidden');
    await page.setViewportSize({ width: 767, height: 900 });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
  });

  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    test(`${prefix || 'zh'} ClientRouter preserves the document, focuses each heading and supports history (${reducedMotion})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.emulateMedia({ reducedMotion });
      await page.goto(`${prefix}/`);
      const homeTitle = await page.title();
      const sentinel = await page.evaluate(() => {
        const diagnostic = {
          sentinel: Math.random().toString(36),
          calls: 0,
          animations: [] as Array<{ name: string; duration: number }>,
          headers: [] as Array<{ top: number; height: number }>,
        };
        Reflect.set(window, 'n1NavigationDiagnostic', diagnostic);
        const original = document.startViewTransition;
        document.startViewTransition = function (...args: Parameters<typeof original>) {
          diagnostic.calls++;
          const transition = Reflect.apply(original, document, args) as ReturnType<typeof original>;
          void transition.ready
            .then(() => {
              const header = document.querySelector('.site-header')!.getBoundingClientRect();
              diagnostic.headers.push({ top: header.top, height: header.height });
              for (const animation of document.getAnimations()) {
                if (
                  animation instanceof CSSAnimation &&
                  animation.animationName.startsWith('n1-')
                ) {
                  diagnostic.animations.push({
                    name: animation.animationName,
                    duration: Number(animation.effect!.getComputedTiming().duration),
                  });
                }
              }
            })
            .catch(() => {
              /* A superseded transition is allowed to reject its ready promise. */
            });
          return transition;
        };
        return diagnostic.sentinel;
      });
      const assertNavigation = async (route: string, expectedTitle?: string) => {
        await expect(page).toHaveURL(new RegExp(`${route}$`));
        await expect(page.locator('main h1')).toBeFocused();
        expect(
          await page.evaluate(() => Reflect.get(window, 'n1NavigationDiagnostic')?.sentinel),
        ).toBe(sentinel);
        if (expectedTitle) await expect(page).toHaveTitle(expectedTitle);
        const header = await page.locator('.site-header').boundingBox();
        expect(header!.y).toBe(0);
        expect(header!.height).toBe(52);
      };
      await page.getByTestId('desktop-nav').locator(`a[href="${prefix}/work/"]`).click();
      await assertNavigation(`${prefix}/work/`);
      const workTitle = await page.title();
      expect(workTitle).not.toBe(homeTitle);
      await page.locator('.work-row').first().click();
      await assertNavigation(`${prefix}/work/sample-case/`);
      const detailTitle = await page.title();
      expect(detailTitle).not.toBe(workTitle);
      await page.goBack();
      await assertNavigation(`${prefix}/work/`, workTitle);
      await page.goForward();
      await assertNavigation(`${prefix}/work/sample-case/`, detailTitle);
      await page.getByTestId('desktop-nav').locator(`a[href="${prefix}/lab/"]`).click();
      await assertNavigation(`${prefix}/lab/`);
      await page.locator('.n1-nav-shell > .site-name').click();
      await assertNavigation(`${prefix}/`, homeTitle);
      await expect(page.getByTestId('desktop-nav').locator('[aria-current="page"]')).toHaveCount(0);
      const diagnostic = await page.evaluate(
        () =>
          Reflect.get(window, 'n1NavigationDiagnostic') as {
            calls: number;
            animations: Array<{ name: string; duration: number }>;
            headers: Array<{ top: number; height: number }>;
          },
      );
      if (reducedMotion === 'reduce') {
        expect(diagnostic.animations.filter((animation) => animation.duration > 0)).toEqual([]);
      } else {
        expect(diagnostic.calls).toBeGreaterThan(0);
        expect(
          diagnostic.animations.some(
            (animation) => animation.name === 'n1-enter' && animation.duration > 0,
          ),
        ).toBe(true);
        expect(diagnostic.animations.every((animation) => animation.duration <= 300)).toBe(true);
      }
      for (const header of diagnostic.headers) expect(header).toEqual({ top: 0, height: 52 });
    });
  }
}
