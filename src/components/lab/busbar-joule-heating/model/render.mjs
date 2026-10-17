// Renders the committed GLB in Chromium to the static WebP preview (same camera as the viewer).
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { CAMERA } from '../viewer-shared.ts';

const WIDTH = 1600;
const HEIGHT = 1000;
const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setSize(${WIDTH},${HEIGHT}); renderer.setPixelRatio(1); renderer.setClearColor(0xffffff,0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.loadAsync('/model.glb'); scene.add(gltf.scene);
let meshes = 0;
gltf.scene.traverse((object) => {
  if (object.isLineSegments) { object.material.transparent = true; object.material.opacity = 0.5; }
  if (object.isMesh) { meshes += 1; object.material.side = THREE.DoubleSide; if (object.material.transparent) object.material.depthWrite = false; }
});
// Viewer default camera (CAMERA in viewer-shared.ts), converted from mm to metres.
const camera = new THREE.PerspectiveCamera(${CAMERA.fov}, ${WIDTH}/${HEIGHT}, 0.001, 2);
const target = new THREE.Vector3(${CAMERA.target.map((v) => v / 1000).join(',')});
camera.position.copy(new THREE.Vector3(${CAMERA.direction.join(',')}).normalize().multiplyScalar(${CAMERA.distance / 1000}).add(target));
camera.lookAt(target);
function render() {
  renderer.render(scene, camera);
  const small = document.createElement('canvas'); small.width = ${WIDTH / 2}; small.height = ${HEIGHT / 2};
  const context = small.getContext('2d'); context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  context.drawImage(renderer.domElement, 0, 0, small.width, small.height);
  const phone = document.createElement('canvas'); phone.width = 480; phone.height = 300;
  const phoneContext = phone.getContext('2d'); phoneContext.imageSmoothingEnabled = true; phoneContext.imageSmoothingQuality = 'high';
  phoneContext.drawImage(renderer.domElement, 0, 0, phone.width, phone.height);
  return { webp: renderer.domElement.toDataURL('image/webp', 0.9), small: small.toDataURL('image/webp', 0.9), phone: phone.toDataURL('image/webp', 0.85), png: renderer.domElement.toDataURL('image/png'), meshes };
}
window.modelRender = render; window.modelReady = true;
</script>`;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function renderPoster({ root, glb, outputs, evidence }) {
  const threeRoot = fileURLToPath(new URL('../', import.meta.resolve('three')));
  const server = createServer(async (request, response) => {
    try {
      if (request.url === '/') {
        response.setHeader('Content-Type', 'text/html');
        response.end(html);
        return;
      }
      if (request.url === '/model.glb') {
        response.setHeader('Content-Type', 'model/gltf-binary');
        response.end(await readFile(glb));
        return;
      }
      if (!request.url?.startsWith('/three/') || request.url.includes('..')) {
        response.statusCode = 404;
        response.end();
        return;
      }
      response.setHeader('Content-Type', 'text/javascript');
      response.end(await readFile(path.join(threeRoot, request.url.slice('/three/'.length))));
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const executablePath = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
    });
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.modelReady === true, { timeout: 30_000 });
    const first = await page.evaluate(() => window.modelRender());
    const second = await page.evaluate(() => window.modelRender());
    if (failures.length) throw new Error(failures.join('\n'));
    if (first.webp !== second.webp || first.small !== second.small || first.phone !== second.phone)
      throw new Error('Same-session repeated WebP rendering differs');
    const large = Buffer.from(first.webp.split(',')[1], 'base64');
    const small = Buffer.from(first.small.split(',')[1], 'base64');
    const phone = Buffer.from(first.phone.split(',')[1], 'base64');
    for (const image of [large, small, phone])
      if (image.subarray(0, 4).toString() !== 'RIFF' || image.subarray(8, 12).toString() !== 'WEBP')
        throw new Error('Browser did not encode a WebP');
    const decode = (uri) =>
      page.evaluate(async (uri) => {
        const image = new Image();
        image.src = uri;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 20) visible++;
        return { width: image.naturalWidth, height: image.naturalHeight, visiblePixels: visible };
      }, uri);
    const largeInfo = await decode(first.webp);
    const smallInfo = await decode(first.small);
    const phoneInfo = await decode(first.phone);
    if (phoneInfo.width !== 480 || phoneInfo.height !== 300 || phoneInfo.visiblePixels < 9_000)
      throw new Error('Empty or invalid phone poster');
    if (
      largeInfo.width !== WIDTH ||
      largeInfo.height !== HEIGHT ||
      largeInfo.visiblePixels < 100_000
    )
      throw new Error('Empty or invalid poster');
    if (smallInfo.width !== WIDTH / 2 || smallInfo.visiblePixels < 25_000)
      throw new Error('Empty or invalid responsive poster');
    await writeFile(outputs.large, large);
    await writeFile(outputs.small, small);
    await writeFile(outputs.phone, phone);
    if (evidence)
      await writeFile(
        path.join(evidence, 'busbar-default.png'),
        Buffer.from(first.png.split(',')[1], 'base64'),
      );
    const rel = (file) =>
      '/' + path.relative(path.join(root, 'public'), file).split(path.sep).join('/');
    return {
      large: { path: rel(outputs.large), bytes: large.length, sha256: sha(large), ...largeInfo },
      small: { path: rel(outputs.small), bytes: small.length, sha256: sha(small), ...smallInfo },
      phone: { path: rel(outputs.phone), bytes: phone.length, sha256: sha(phone), ...phoneInfo },
      meshCount: first.meshes,
      repeatedWebpEqual: true,
      browserVersion: browser.version(),
      deterministicScope:
        'Two renders in one pinned Chromium session; GPU/browser upgrades may change bytes.',
    };
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
