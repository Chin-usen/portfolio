const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const base = process.cwd();
const out = path.join(base, '.dev-tools/v3-after-b');
const app = path.join(base, 'portfolio-main-v3');
const { chromium } = require(path.join(app, 'node_modules/@playwright/test'));
const result = { assessment: 'B', kind: 'supplementary-current-build-zoom-capture', started: new Date().toISOString(), browserClosed: false };
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const routeFiles = ['dist/index.html', 'dist/en/index.html', 'dist/lab/chip-junction-temperature/index.html', 'dist/en/lab/chip-junction-temperature/index.html'];
const hashes = () => routeFiles.map(file => ({ file, sha256: sha(path.join(app, file)) }));
(async () => {
  result.builtHashesBefore = hashes();
  const ext = path.join(out, 'zoom-extension');
  const context = await chromium.launchPersistentContext(path.join(out, 'zoom-finalization-profile'), {
    channel: 'chromium', headless: true, viewport: { width: 1440, height: 1000 }, colorScheme: 'light',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`]
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 });
    const page = await context.newPage();
    result.url = 'http://127.0.0.1:4337/en/';
    await page.goto(result.url);
    await page.evaluate(() => document.fonts.ready);
    result.zoom = await worker.evaluate(async url => {
      const tab = (await chrome.tabs.query({})).find(t => t.url === url);
      await chrome.tabs.setZoom(tab.id, 2);
      return chrome.tabs.getZoom(tab.id);
    }, result.url);
    await page.waitForTimeout(350);
    await page.evaluate(() => scrollTo(0, 0));
    result.geometry = await page.evaluate(() => ({
      innerWidth, innerHeight, dpr: devicePixelRatio, visualScale: visualViewport.scale,
      clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      scrollX, scrollY, fonts: document.fonts.status,
      headings: [...document.querySelectorAll('h1')].map(el => ({ text: el.textContent, rect: el.getBoundingClientRect().toJSON() }))
    }));
    const cdp = await context.newCDPSession(page);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const png = Buffer.from(shot.data, 'base64');
    result.screenshot = 'screenshots/zoom200-home-en-viewport.png';
    fs.writeFileSync(path.join(out, result.screenshot), png);
    result.pixelDimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    result.screenshotSha256 = crypto.createHash('sha256').update(png).digest('hex');
    result.builtHashesAfter = hashes();
    result.buildUnchangedDuringCapture = JSON.stringify(result.builtHashesBefore) === JSON.stringify(result.builtHashesAfter);
    result.captureComplete = true;
  } finally {
    await context.close();
    result.browserClosed = true;
    result.finished = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'zoom-viewport-confirmation.json'), JSON.stringify(result, null, 2));
  }
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
