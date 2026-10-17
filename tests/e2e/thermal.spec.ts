import { expect, test } from '@playwright/test';
import path from 'node:path';

const thermalReports = path.join(process.env.V5_REPORT_DIR ?? 'test-results', 'thermal');

const route = '/lab/chip-junction-temperature/';

test('thermal interaction, default benchmark, keyboard tabs and material presets', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(route);
  await expect(page.locator('[data-value="tj"]')).toHaveText('125.6');
  await expect(page.locator('[data-value="rth"]')).toHaveText('0.606');
  await expect(page.locator('[data-thermal-renderer]')).toHaveAttribute(
    'data-thermal-renderer',
    /webgl|fallback/,
  );
  const first = page.getByRole('tab').first();
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '上焊层', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'SAC305 · 58' }).click();
  await expect(page.locator('[data-param="k_st"]')).toHaveValue('58');
  await expect(page.locator('[data-value="tj"]')).not.toHaveText('125.6');
  await page.locator('[data-select-layer="ceramic"]').click();
  await expect(page.locator('[data-tab="amb"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-layer-card]')).toBeVisible();
  await page.locator('[data-reset-params]').click();
  await expect(page.locator('[data-value="tj"]')).toHaveText('125.6');
  await page.locator('[data-tab="operating"]').click();
  await page.locator('[data-param="P"]').fill('500');
  await expect(page.locator('[data-warning]')).toBeVisible();
  await expect(page.locator('[data-warning]')).toContainText('超过 SiC 器件常见最高结温 175 °C');
  await page.locator('[data-cutaway]').click();
  await page.locator('[data-explode]').click();
  await expect(page.locator('[data-cutaway]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-explode]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-reset-view]').click();
  expect(errors).toEqual([]);
});

test('thermal bilingual routes, mobile sizes, color themes and real screenshot QA', async ({
  page,
}) => {
  for (const language of ['zh', 'en']) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1080 : 844 });
      await page.emulateMedia({
        colorScheme: width === 390 ? 'dark' : 'light',
        reducedMotion: 'reduce',
      });
      await page.goto(language === 'zh' ? route : `/en${route}`);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('[data-thermal-renderer]')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(
        language === 'zh' ? '芯片结温仿真' : 'Chip junction temperature',
      );
      const measure = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: innerWidth,
      }));
      expect(measure.scroll).toBeLessThanOrEqual(measure.width + 1);
      expect(await page.locator('input[type="range"]').count()).toBe(14);
      await page.screenshot({
        path: path.join(thermalReports, `thermal-${language}-${width}.png`),
        fullPage: true,
      });
    }
  }
});

test('forced 2D fallback remains operable with keyboard and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${route}?renderer=2d`);
  await expect(page.locator('[data-thermal-renderer]')).toHaveAttribute(
    'data-thermal-renderer',
    'fallback',
  );
  await expect(page.locator('[data-fallback-note]')).toBeVisible();
  const ceramic = page.locator('svg [data-thermal-layer="ceramic"]');
  await ceramic.focus();
  await page.keyboard.press('Enter');
  await expect(ceramic).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-tab="amb"]')).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-param="t_cer"]').fill('1');
  await expect(page.locator('[data-param-output="t_cer"]')).toContainText('1');
  await page.locator('[data-explode]').click();
  await page.screenshot({
    path: path.join(thermalReports, 'thermal-fallback.png'),
    fullPage: true,
  });
});

test('WebGL orbit and demand rendering stop when idle', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    const diagnostic = { calls: 0 };
    Object.defineProperty(window, 'thermalRafDiagnostic', { value: diagnostic });
    window.requestAnimationFrame = (callback) => {
      diagnostic.calls++;
      return original(callback);
    };
  });
  await page.goto(route);
  await expect(page.locator('[data-thermal-renderer]')).toHaveAttribute(
    'data-thermal-renderer',
    'webgl',
  );
  const canvas = page.locator('canvas[data-thermal-canvas="webgl"]');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.6, {
    steps: 12,
  });
  await page.mouse.up();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(800);
  const count = () =>
    page.evaluate(() => Reflect.get(window, 'thermalRafDiagnostic').calls as number);
  const idle = await count();
  await page.waitForTimeout(300);
  expect(await count()).toBe(idle);
  await page.locator('[data-param="P"]').fill('150');
  await expect(page.locator('[data-value="tj"]')).toHaveText('155.8');
  expect(await count()).toBeGreaterThan(idle);
});

test('FEM model loads real scalar and field assets, switches back, and handles extremes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(route);
  await page.locator('button[data-model="fem"]').click();
  await expect(page.locator('[data-thermal-lab]')).toHaveAttribute('data-model', 'fem');
  await expect(page.locator('[data-model-label]')).toHaveText('FEM 训练的代理模型');
  await expect(page.locator('[data-value="tj"]')).not.toHaveText('125.6');
  await expect(page.locator('[data-source-node]')).toContainText('面均温');
  await expect(page.locator('[data-field-disclosure]')).toContainText('POD');
  await page.locator('[data-cutaway]').click();
  await page.screenshot({
    path: path.join(thermalReports, 'thermal-fem-cutaway.png'),
    fullPage: true,
  });
  for (const endpoint of ['max', 'min']) {
    for (const tab of await page.locator('[data-tab]').all()) {
      await tab.click();
      for (const input of await page.locator('[data-panel]:not([hidden]) [data-param]').all()) {
        await input.fill((await input.getAttribute(endpoint))!);
      }
    }
    await expect(page.locator('[data-input-error]')).toBeHidden();
    expect(Number.isFinite(Number(await page.locator('[data-value="tj"]').textContent()))).toBe(
      true,
    );
  }
  await page.locator('[data-reset-params]').click();
  await page.locator('button[data-model="analytic"]').click();
  await expect(page.locator('[data-value="tj"]')).toHaveText('125.6');
  expect(errors).toEqual([]);
});

test('a lost WebGL context activates the usable 2D renderer', async ({ page }) => {
  await page.goto(route);
  await expect(page.locator('[data-thermal-renderer]')).toHaveAttribute(
    'data-thermal-renderer',
    'webgl',
  );
  const available = await page
    .locator('canvas[data-thermal-canvas="webgl"]')
    .evaluate((element) => {
      const gl = (element as HTMLCanvasElement).getContext('webgl2');
      const loss = gl?.getExtension('WEBGL_lose_context');
      if (!loss) return false;
      loss.loseContext();
      return true;
    });
  expect(available).toBe(true);
  await expect(page.locator('[data-thermal-renderer]')).toHaveAttribute(
    'data-thermal-renderer',
    'fallback',
  );
  await expect(page.locator('[data-fallback-note]')).toBeVisible();
  await page.locator('[data-param="P"]').fill('150');
  await expect(page.locator('[data-value="tj"]')).toHaveText('155.8');
});

test('record frame timings while changing FEM power every animation frame', async ({ page }) => {
  await page.goto(route);
  await page.locator('button[data-model="fem"]').click();
  await expect(page.locator('[data-thermal-lab]')).toHaveAttribute('data-model', 'fem');
  await expect(page.locator('[data-thermal-renderer]')).toHaveAttribute(
    'data-thermal-renderer',
    'webgl',
  );
  const report = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('[data-param="P"]')!;
    const durations: number[] = [];
    let previous = 0;
    await new Promise<void>((resolve) => {
      let frame = 0;
      const next = (now: number) => {
        if (frame > 20) durations.push(now - previous);
        previous = now;
        input.value = String(50 + (frame % 90) * 5);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        frame++;
        if (frame < 141) requestAnimationFrame(next);
        else resolve();
      };
      requestAnimationFrame(next);
    });
    const sorted = [...durations].sort((a, b) => a - b);
    const mean = durations.reduce((sum, x) => sum + x, 0) / durations.length;
    return {
      mode: 'FEM',
      frames: durations.length,
      meanFrameMs: mean,
      meanFps: 1000 / mean,
      medianFrameMs: sorted[Math.floor(sorted.length * 0.5)],
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio,
    };
  });
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir(thermalReports, { recursive: true });
  await writeFile(
    path.join(thermalReports, 'browser-frame-timings.json'),
    JSON.stringify(report, null, 2),
  );
  expect(report.frames).toBe(120);
  await expect(page.locator('[data-input-error]')).toBeHidden();
});

test('convection locates boundary conditions and field captions follow the active model', async ({
  page,
}) => {
  await page.goto('/en/lab/chip-junction-temperature/');
  const lab = page.locator('[data-thermal-lab]');
  const initialTemperature = await lab.locator('[data-value="tj"]').textContent();
  await lab.locator('[data-select-layer="cooler"]').click();
  await expect(lab.locator('[data-layer-card]')).toBeVisible();
  await lab.locator('[data-select-layer="convection"]').click();
  await expect(lab.locator('[data-tab="operating"]')).toHaveAttribute('aria-selected', 'true');
  await expect(lab.locator('[data-param="h"]')).toBeVisible();
  await expect(lab.locator('[data-layer-card]')).toBeHidden();
  await expect(lab.locator('[data-select-layer="convection"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(lab.locator('[data-select-layer="cooler"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(lab.locator('[data-value="tj"]')).toHaveText(initialTemperature ?? '');
  await expect(lab.locator('[data-field-caption]')).toContainText('Illustrative field');
  await lab.locator('[data-model="fem"]').click();
  await expect(lab.locator('[data-field-caption]')).toContainText('Reconstructed central plane');
  await lab.locator('[data-model="analytic"]').click();
  await expect(lab.locator('[data-field-caption]')).toContainText('Illustrative field');
});

test('scrolled parameter tabs remain visible and clickable above the sticky result', async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const prefix of ['', '/en']) {
      await page.goto(`${prefix}/lab/chip-junction-temperature/`);
      await page.locator('[data-select-layer="ceramic"]').click();
      await page.locator('.thermal-tabs').evaluate((tabs) => {
        window.scrollTo(0, window.scrollY + tabs.getBoundingClientRect().top - 70);
      });
      const hitTargets = await page.locator('.thermal-tabs [data-tab]').evaluateAll((tabs) =>
        tabs.map((tab) => {
          const rect = tab.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return {
            tab: tab.getAttribute('data-tab'),
            visible: rect.top >= 52,
            reachable: hit === tab || tab.contains(hit),
          };
        }),
      );
      for (const target of hitTargets) {
        expect(target.visible, `${width} ${prefix} ${target.tab} is below the header`).toBe(true);
        expect(target.reachable, `${width} ${prefix} ${target.tab} is not obscured`).toBe(true);
      }
      await page.locator('[data-tab="operating"]').click();
      await expect(page.locator('[data-param="h"]')).toBeVisible();
    }
  }
});

test('200 percent mobile warnings leave the convection control reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const prefix of ['', '/en']) {
    await page.goto(`${prefix}/lab/chip-junction-temperature/`);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.locator('[data-param="P"]').press('End');
    await expect(page.locator('[data-control-tj]')).toHaveText('367.8');
    const h = page.locator('[data-param="h"]');
    await h.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        h.evaluate((input) => {
          const r = input.getBoundingClientRect();
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === input;
        }),
      )
      .toBe(true);
    const initial = Number(await h.inputValue());
    await h.press('ArrowRight');
    expect(Number(await h.inputValue())).toBeGreaterThan(initial);
    await expect(page.locator('[data-control-warning]')).toBeVisible();
    await page.locator('[data-reset-params]').click();
    await expect(page.locator('[data-control-tj]')).toHaveText('125.6');
    await expect(page.locator('[data-control-warning]')).toBeHidden();
  }
});
