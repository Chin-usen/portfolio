import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format } from 'prettier';
import { buildPinFin } from './build.mjs';
import { renderModel } from './render.mjs';
import { DEFAULT_PARAMS } from '../parameters.ts';
import { PART_IDS } from '../geometry.ts';
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const expectedNode = (await readFile(path.join(root, '.node-version'), 'utf8')).trim();
if (process.versions.node !== expectedNode)
  throw new Error(
    `Model byte reproducibility requires Node ${expectedNode}; current ${process.versions.node}. Use the pinned project runtime.`,
  );
const output = path.join(root, 'public/models/pin-fin-cooler');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidenceArg = process.argv.indexOf('--evidence');
const evidence = evidenceArg < 0 ? null : path.resolve(process.argv[evidenceArg + 1]);
await mkdir(output, { recursive: true });
if (evidence) await mkdir(evidence, { recursive: true });
const first = await buildPinFin(),
  second = await buildPinFin();
if (!first.binary.equals(second.binary) || first.geometrySha256 !== second.geometrySha256)
  throw new Error('Repeated pin-fin geometry/GLB differs');
await writeFile(path.join(output, 'pin-fin-cooler.glb'), first.binary);
const rendering = await renderModel({
  root,
  output: path.join(output, 'pin-fin-cooler-preview.webp'),
  responsiveOutput: path.join(output, 'pin-fin-cooler-preview-800.webp'),
  evidence,
});
const SOURCE_NAMES = [
  'parameters.ts',
  'layout.ts',
  'geometry.ts',
  'model/build.mjs',
  'model/render.mjs',
  'model/generate.mjs',
  'model/verify.mjs',
].map((name) => `src/components/lab/pin-fin-cooler/${name}`);
const sourceNames = [...SOURCE_NAMES, '.node-version'];
const sourceSha256 = Object.fromEntries(
  await Promise.all(
    sourceNames.map(async (name) => [name, hash(await readFile(path.join(root, name)))]),
  ),
);
const manifest = {
  version: 1,
  modelKind: 'parametric-pin-fin-cold-plate-schematic',
  descriptionEn:
    'Original generic pin-fin cold plate at the default slider values; illustrative simplified geometry, no vendor replication or manufacturing dimensions',
  runtime:
    'The page rebuilds the same geometry from geometry.ts as the sliders change (instanced pins); this GLB is the reproducible default-parameter export used for the static preview',
  units: 'm',
  sourceUnits: 'mm',
  upAxis: 'Y',
  coordinateTransform: 'mm scaled by 0.001; +X along the flow, +Y normal to the base, +Z across',
  parameters: DEFAULT_PARAMS,
  parts: PART_IDS.map((id) => ({ id, name: id, nodeName: id })),
  metrics: { pinCount: first.pinCount },
  reproducibility: {
    deterministicScope:
      'Exact pinned Node and dependency versions; cross-runtime floating-point serialization is not claimed',
    geometrySha256: first.geometrySha256,
    repeatedGeometryEqual: true,
    repeatedGlbEqual: true,
    sourceSha256,
  },
  assets: {
    glb: {
      path: '/models/pin-fin-cooler/pin-fin-cooler.glb',
      bytes: first.binary.length,
      sha256: hash(first.binary),
      compression: 'EXT_meshopt_compression; 16-bit positions / 10-bit normals',
    },
    previewWebp: { ...rendering.asset, width: 1600, height: 1000 },
    previewWebp800: rendering.responsive.asset,
  },
  validation: {
    namedIndependentMeshes: first.nodeCount,
    totalTriangles: first.triangles,
    finiteGeometry: true,
    compressedNodeMetadataPreserved: true,
  },
  toolchain: {
    node: process.versions.node,
    three: '0.186.1',
    gltfTransform: '4.2.1',
    meshoptimizer: '0.23.0',
    renderer: 'Three.js + Playwright Chromium',
  },
};
const manifestBytes = Buffer.from(
  await format(JSON.stringify(manifest), { parser: 'json', printWidth: 100 }),
);
if (first.binary.length + manifestBytes.length > 1_500_000)
  throw new Error('Pin-fin GLB + manifest exceeds 1.5 MB');
await writeFile(path.join(output, 'model-manifest.json'), manifestBytes);
const report = {
  status: 'passed',
  nodeCount: first.nodeCount,
  pinCount: first.pinCount,
  triangles: first.triangles,
  rawBytes: first.rawBytes,
  glbBytes: first.binary.length,
  manifestBytes: manifestBytes.length,
  geometrySha256: first.geometrySha256,
  glbSha256: hash(first.binary),
  manifestSha256: hash(manifestBytes),
  rendering: {
    largeBytes: rendering.asset.bytes,
    smallBytes: rendering.responsive.asset.bytes,
    visiblePixels: rendering.visiblePixels,
    browserVersion: rendering.browserVersion,
  },
};
if (evidence)
  await writeFile(
    path.join(evidence, 'model-validation.json'),
    JSON.stringify({ ...report, rendering, sourceSha256 }, null, 2) + '\n',
  );
console.log(JSON.stringify(report, null, 2));
