import { expect, test } from '@playwright/test';

for (const prefix of ['', '/en']) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${prefix || 'zh'} ${theme} Home balances the visible module and contact spacing`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 1280, height: 720 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(`${prefix}/`);
        await page.evaluate(() => document.fonts.ready);
        const footer = await page.locator('.footer-links').evaluate((element) => {
          const targets = [...element.querySelectorAll('a, span')].map((item) => {
            const range = document.createRange();
            range.selectNodeContents(item);
            return { text: range.getBoundingClientRect(), box: item.getBoundingClientRect() };
          });
          return {
            gaps: targets
              .slice(1)
              .map((item, index) => item.text.left - targets[index]!.text.right),
            boxes: targets.map((item) => ({ width: item.box.width, height: item.box.height })),
          };
        });
        expect(Math.abs(footer.gaps[0]! - footer.gaps[1]!)).toBeLessThanOrEqual(1);
        for (const target of footer.boxes) {
          expect(target.width).toBeGreaterThanOrEqual(44);
          expect(target.height).toBeGreaterThanOrEqual(44);
        }
      }

      const image = page.locator('.home-module img');
      await image.evaluate((element: HTMLImageElement) => element.decode());
      const visibleModule = await image.evaluate((element: HTMLImageElement) => {
        const canvas = document.createElement('canvas');
        canvas.width = element.naturalWidth;
        canvas.height = element.naturalHeight;
        const context = canvas.getContext('2d')!;
        context.drawImage(element, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const matte = [pixels[0]!, pixels[1]!, pixels[2]!];
        let left = canvas.width;
        let right = -1;
        let bottom = -1;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const offset = (y * canvas.width + x) * 4;
            // Ignore the supplied raster's matte and faint shadow; measure its actual subject.
            if (matte.some((channel, index) => Math.abs(pixels[offset + index]! - channel) > 45)) {
              left = Math.min(left, x);
              right = Math.max(right, x);
              bottom = Math.max(bottom, y);
            }
          }
        }
        const box = element.getBoundingClientRect();
        const scale = Math.min(box.width / canvas.width, box.height / canvas.height);
        const [xPosition, yPosition] = getComputedStyle(element)
          .objectPosition.split(' ')
          .map(parseFloat);
        const offsetX = ((box.width - canvas.width * scale) * xPosition!) / 100;
        const offsetY = ((box.height - canvas.height * scale) * yPosition!) / 100;
        const footer = document.querySelector('.site-footer')!.getBoundingClientRect();
        return {
          left: box.left + offsetX + left * scale,
          right: box.left + offsetX + (right + 1) * scale,
          width: (right - left + 1) * scale,
          bottomGap: footer.top - (box.top + offsetY + (bottom + 1) * scale),
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
        };
      });
      expect(visibleModule.width).toBeGreaterThanOrEqual(300);
      expect(visibleModule.left).toBeGreaterThanOrEqual(16);
      expect(visibleModule.right).toBeLessThanOrEqual(visibleModule.viewportWidth - 16);
      expect(visibleModule.bottomGap).toBeGreaterThanOrEqual(24);
      expect(visibleModule.bottomGap).toBeLessThanOrEqual(160);
      expect(visibleModule.documentWidth).toBeLessThanOrEqual(visibleModule.viewportWidth);
      expect(visibleModule.documentHeight).toBeLessThanOrEqual(visibleModule.viewportHeight);

      await page.getByTestId('menu-toggle').click();
      const contact = await page.locator('.n1-menu-contact').evaluate((element) => {
        const items = [...element.children].map((item) => {
          const range = document.createRange();
          range.selectNodeContents(item);
          return { text: range.getBoundingClientRect(), box: item.getBoundingClientRect() };
        });
        return {
          gaps: [
            items[1]!.text.left - items[0]!.text.right,
            items[2]!.text.left - items[1]!.text.right,
          ],
          targets: [items[0]!.box, items[2]!.box].map((box) => ({
            width: box.width,
            height: box.height,
          })),
        };
      });
      expect(Math.abs(contact.gaps[0]! - contact.gaps[1]!)).toBeLessThanOrEqual(1);
      for (const target of contact.targets) {
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('menu-toggle')).toBeFocused();

      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      const reflow = await page.locator('.site-footer').evaluate((element) => {
        const footer = element.getBoundingClientRect();
        const targets = [...element.querySelectorAll('.footer-links a, .footer-links span')];
        return {
          width: document.documentElement.scrollWidth,
          footerBottom: footer.bottom,
          lastTargetBottom: Math.max(
            ...targets.map((target) => target.getBoundingClientRect().bottom),
          ),
        };
      });
      expect(reflow.width).toBeLessThanOrEqual(390);
      expect(reflow.lastTargetBottom).toBeLessThanOrEqual(reflow.footerBottom);
    });
  }
}
