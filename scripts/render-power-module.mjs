/** Development-only, offline, reproducible product-hero asset generation. */
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { format } from 'prettier';

const project = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(project, 'public/images');
const files = new Map([
  ['/scene.mjs', path.join(project, 'scripts/power-module-scene.mjs')],
  ['/three.module.js', path.join(project, 'node_modules/three/build/three.module.js')],
  ['/three.core.js', path.join(project, 'node_modules/three/build/three.core.js')],
]);
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Power module asset renderer</title>
<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>
<script type="module">import { renderPowerModule } from '/scene.mjs'; window.renderPowerModule = renderPowerModule;</script></html>`;
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      return;
    }
    const filename = files.get(request.url);
    if (!filename) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    response.end(await readFile(filename));
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  // Rendering cannot load external models, fonts, textures, or other resources.
  await page.route('**/*', (route) =>
    route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort(),
  );
  page.on('pageerror', (error) => console.error(error));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.renderPowerModule === 'function');
  await mkdir(output, { recursive: true });
  const assets = [];
  for (const theme of ['light', 'dark']) {
    for (const width of [900, 450]) {
      const height = (width * 2) / 3;
      const data = await page.evaluate(
        ({ width, height, theme }) => {
          const canvas = window.renderPowerModule({ width, height, theme });
          return canvas.toDataURL('image/webp', 0.92);
        },
        { width, height, theme },
      );
      const match = /^data:image\/(webp|png);base64,(.+)$/.exec(data);
      if (!match) throw new Error('Browser did not encode a WebP or PNG image');
      const filename = `power-module-${theme}-${width}.${match[1]}`;
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.length > 65000) throw new Error(`Asset exceeded 65 kB budget: ${filename}`);
      await writeFile(path.join(output, filename), bytes);
      assets.push({ filename, width, height, bytes: bytes.length, theme });
      console.log(`${filename}: ${width} x ${height}, ${bytes.length} bytes`);
    }
  }
  const rows = assets
    .map(
      (asset) =>
        `| public/images/${asset.filename} | ${asset.width} x ${asset.height} | ${asset.bytes} |`,
    )
    .join('\n');
  const readme =
    `# Generic power-module hero\n\n` +
    `Original, self-initiated geometric illustration authored for this repository. ` +
    `It contains one aluminum-gray baseplate, one dark rectangular housing, and exactly three copper-colored upright terminals. ` +
    `All dimensions are arbitrary scene units; this is not an engineering specification, validated engineering model, employer design, or commercial product replica.\n\n` +
    `## Source and licensing\n\n` +
    `- Scene source: scripts/power-module-scene.mjs. Native Three.js BoxGeometry, with small procedurally generated edge radii.\n` +
    `- Renderer: scripts/render-power-module.mjs. Headless Chromium runs at build/authoring time only.\n` +
    `- All geometry, studio-light panels, shadow, and materials were authored in source; no external images, HDR maps, manufacturer geometry, downloaded models, or other asset files are used.\n` +
    `- Three.js 0.186.1 is MIT-licensed (node_modules/three/LICENSE). Playwright is Apache-2.0-licensed (node_modules/playwright-core/LICENSE). The newly authored scene, scripts, and generated images are dedicated under CC0-1.0; this dedication does not alter dependency licenses or grant rights over unrelated repository content.\n` +
    `- Visual composition follows docs/design/D1-desktop.html and D1-mobile.html plus their supplied JPG references. The simplified generic geometry was newly built, rather than extracted from a model.\n` +
    `- Before public publication, retain the repository content-policy review of generic power-module imagery; this illustration makes no claim about professional work.\n\n` +
    `## Reproduce\n\n` +
    `From the repository root, with the locked dependencies and Playwright Chromium already installed:\n\n` +
    '```sh\nnode scripts/render-power-module.mjs\n```\n\n' +
    `Validated with Node 22 and Three.js 0.186.1. The renderer starts and closes its own loopback server on an ephemeral port, blocks external browser requests, renders at 2x resolution, downsamples, and encodes WebP at quality 0.92 using the browser canvas encoder. PNG is used only if the browser lacks WebP encoding. Pixel/byte identity across different Chromium or GPU versions is not guaranteed.\n\n` +
    `## Assets\n\n| Path | Dimensions | Bytes |\n| --- | --- | ---: |\n${rows}\n\n` +
    `Light images have an opaque #FBFBFD background; dark images have an opaque #000000 background. Both preserve the same orthographic product silhouette. Use the 450w and 900w files in a responsive srcset, set width/height to 900/600, and keep this authoring source out of the browser bundle. No home-page WebGL, animation, or reduced-motion workaround is needed.\n`;
  await writeFile(
    path.join(project, 'scripts/power-module-README.md'),
    await format(readme, { parser: 'markdown' }),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
