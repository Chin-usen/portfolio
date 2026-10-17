import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setSize(1600,1000); renderer.setPixelRatio(1); renderer.setClearColor(0xffffff,0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff,2.0));
const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(-0.2,0.4,0.3);scene.add(key);
const fill=new THREE.DirectionalLight(0xdde8ff,1.35);fill.position.set(0.3,0.2,-0.3);scene.add(fill);
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
const gltf=await loader.loadAsync('/model.glb');scene.add(gltf.scene);
const owned=[];
gltf.scene.traverse(object=>{if(object.isMesh){owned.push({object,rest:object.position.clone(),});}});
const camera=new THREE.OrthographicCamera(-.1,.1,.1,-.1,.001,10);
function render(mode){
for(const {object} of owned)object.visible=!(mode==='cover-hidden'&&object.name==='cover');
scene.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(gltf.scene);const center=bounds.getCenter(new THREE.Vector3());
camera.position.copy(center).add(new THREE.Vector3(-0.8,1.45,1.25).normalize().multiplyScalar(.4));camera.lookAt(center);camera.updateMatrixWorld(true);
const points=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
const maxX=Math.max(...points.map(p=>Math.abs(p.x))),maxY=Math.max(...points.map(p=>Math.abs(p.y)));
const halfHeight=Math.max(maxY,maxX/(1600/1000))*1.1;
camera.left=-halfHeight*1600/1000;camera.right=-camera.left;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
renderer.render(scene,camera);
const responsive=document.createElement('canvas');responsive.width=800;responsive.height=500;
const context=responsive.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
context.drawImage(renderer.domElement,0,0,800,500);
return {responsiveWebp:responsive.toDataURL('image/webp',.93),webp:renderer.domElement.toDataURL('image/webp',.93),png:renderer.domElement.toDataURL('image/png'),meshCount:owned.length,webgl:renderer.getContext().getParameter(renderer.getContext().VERSION),bounds:bounds.min.toArray().concat(bounds.max.toArray())};
}
window.modelRender=render;window.modelReady=true;
</script>`;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function renderModel({ root, output, responsiveOutput, evidence }) {
  const threeRoot = fileURLToPath(new URL('../', import.meta.resolve('three')));
  const packageRoot = threeRoot;
  const server = createServer(async (request, response) => {
    try {
      if (request.url === '/') {
        response.setHeader('Content-Type', 'text/html');
        response.end(html);
        return;
      }
      if (request.url === '/model.glb') {
        response.setHeader('Content-Type', 'model/gltf-binary');
        response.end(
          await readFile(path.join(root, 'public/models/pin-fin-cooler/pin-fin-cooler.glb')),
        );
        return;
      }
      if (!request.url?.startsWith('/three/') || request.url.includes('..')) {
        response.statusCode = 404;
        response.end();
        return;
      }
      const filename = path.join(packageRoot, request.url.slice('/three/'.length));
      response.setHeader('Content-Type', 'text/javascript');
      response.end(await readFile(filename));
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
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1,
    });
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.modelReady === true, { timeout: 30_000 });
    const first = await page.evaluate(() => window.modelRender('default'));
    const second = await page.evaluate(() => window.modelRender('default'));
    if (failures.length) throw new Error(failures.join('\n'));
    if (first.webp !== second.webp) throw new Error('Same-session repeated WebP rendering differs');
    if (first.responsiveWebp !== second.responsiveWebp)
      throw new Error('Same-session repeated responsive WebP rendering differs');
    const image = Buffer.from(first.webp.split(',')[1], 'base64');
    const responsiveImage = Buffer.from(first.responsiveWebp.split(',')[1], 'base64');
    if (image.subarray(0, 4).toString() !== 'RIFF' || image.subarray(8, 12).toString() !== 'WEBP')
      throw new Error('Browser did not encode a WebP');
    if (
      responsiveImage.subarray(0, 4).toString() !== 'RIFF' ||
      responsiveImage.subarray(8, 12).toString() !== 'WEBP'
    )
      throw new Error('Browser did not encode a responsive WebP');
    const decodeImage = async (uri) =>
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
    const decoded = await decodeImage(first.webp);
    const responsiveDecoded = await decodeImage(first.responsiveWebp);
    if (decoded.width !== 1600 || decoded.height !== 1000 || decoded.visiblePixels < 100_000)
      throw new Error('Empty or invalid WebP');
    if (
      responsiveDecoded.width !== 800 ||
      responsiveDecoded.height !== 500 ||
      responsiveDecoded.visiblePixels < 16_000
    )
      throw new Error('Empty or invalid responsive WebP');
    await writeFile(output, image);
    await writeFile(responsiveOutput, responsiveImage);
    if (evidence) {
      await writeFile(
        path.join(evidence, 'pin-fin-cooler-preview.png'),
        Buffer.from(first.png.split(',')[1], 'base64'),
      );
      const assembled = await page.evaluate(() => window.modelRender('cover-hidden'));
      await writeFile(
        path.join(evidence, 'pin-fin-cooler-cover-hidden.png'),
        Buffer.from(assembled.png.split(',')[1], 'base64'),
      );
    }
    return {
      asset: {
        path: '/models/pin-fin-cooler/pin-fin-cooler-preview.webp',
        bytes: image.length,
        sha256: sha(image),
      },
      ...decoded,
      responsive: {
        asset: {
          path: '/models/pin-fin-cooler/pin-fin-cooler-preview-800.webp',
          bytes: responsiveImage.length,
          sha256: sha(responsiveImage),
          width: 800,
          height: 500,
        },
        ...responsiveDecoded,
        repeatedWebpEqual: true,
        method: 'High-quality browser canvas downsample of the same actual 1600 x 1000 GLB render',
      },
      meshCount: first.meshCount,
      repeatedWebpEqual: true,
      deterministicScope:
        'Two actual renders in the same pinned Chromium session. GPU/browser upgrades may change image bytes.',
      webgl: first.webgl,
      browserVersion: browser.version(),
      inputGlbSha256: sha(
        await readFile(path.join(root, 'public/models/pin-fin-cooler/pin-fin-cooler.glb')),
      ),
    };
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
