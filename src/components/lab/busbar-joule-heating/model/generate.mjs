// pnpm model:lab busbar-joule-heating [--evidence <dir>]
// Builds the nominal GLB twice (byte-identical), renders the static WebP preview and writes the
// manifest with source, FEM-data, surrogate and asset hashes. It never runs the FEM; see
// model/fem/README.md for regenerating the data and surrogate with Python.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import { buildBusbar, publicDir, root } from './build.mjs';
import { renderPoster } from './render.mjs';
import { DATA_FILES, SOURCE_FILES, SURROGATE_ASSETS } from './sources.mjs';
import { SCALAR_MODEL } from '../evaluator.ts';
import { NOMINAL_GEOMETRY } from '../geometry.ts';

const expectedNode = (await readFile(path.join(root, '.node-version'), 'utf8')).trim();
if (process.versions.node !== expectedNode)
  throw new Error(
    `Byte reproducibility requires Node ${expectedNode}; current ${process.versions.node}.`,
  );
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidenceArg = process.argv.indexOf('--evidence');
const evidence = evidenceArg < 0 ? null : path.resolve(process.argv[evidenceArg + 1]);
if (evidence) await mkdir(evidence, { recursive: true });

const first = await buildBusbar();
const second = await buildBusbar();
if (!first.binary.equals(second.binary) || first.geometrySha256 !== second.geometrySha256)
  throw new Error('Repeated S2 geometry/GLB differs');
const glbPath = path.join(publicDir, 'busbar-default.glb');
await writeFile(glbPath, first.binary);
const rendering = await renderPoster({
  root,
  glb: glbPath,
  outputs: {
    large: path.join(publicDir, 'busbar-default-1600.webp'),
    small: path.join(publicDir, 'busbar-default-800.webp'),
    phone: path.join(publicDir, 'busbar-default-480.webp'),
  },
  evidence,
});
const hashes = async (files) =>
  Object.fromEntries(
    await Promise.all(
      files.map(async (name) => [name, sha(await readFile(path.join(root, name)))]),
    ),
  );
const asset = async (url) => {
  const bytes = await readFile(path.join(root, 'public', url));
  return { path: url, bytes: bytes.length, sha256: sha(bytes) };
};
const l1Sha = sha(await readFile(path.join(root, 'model/l1-half-bridge/params.json')));
if (l1Sha !== SCALAR_MODEL.l1ParamsSha256)
  throw new Error(
    'The surrogate was trained on a different L1 params.json; rerun the FEM pipeline.',
  );
const manifest = {
  version: 1,
  modelKind: 'fem-trained-surrogate-with-parametric-geometry',
  descriptionZh: '参数化示意模型，几何经简化',
  descriptionEn: 'Parametric illustrative model, simplified geometry',
  geometrySource: {
    file: 'model/l1-half-bridge/params.json',
    sha256: l1Sha,
    rule: 'All nominal dimensions read from the L1 file at run time; inputs t replace busbarThickness/collectorThickness and b replaces acBridgeWidth/nRiseDepth/pFeedLength. Layers keep the L1 interlayer clearances.',
    nominal: NOMINAL_GEOMETRY,
  },
  units: 'm (GLB), mm (source geometry)',
  upAxis: 'Y',
  coordinateTransform: '(x,y,z) mm -> (x,z,-y)/1000 metres',
  nodes: first.nodeNames,
  defaultCase: first.defaultCase,
  runtimeGeometry:
    'The page rebuilds the same conductor surfaces from geometry.ts for every (t, b); the GLB is the nominal default-case scene used for the static preview.',
  reproducibility: {
    geometrySha256: first.geometrySha256,
    repeatedGeometryEqual: true,
    repeatedGlbEqual: true,
    sourceSha256: await hashes(SOURCE_FILES),
    femDataSha256: await hashes(DATA_FILES),
  },
  surrogate: {
    assets: await Promise.all(SURROGATE_ASSETS.map(asset)),
    trainingSamples: SCALAR_MODEL.validation.trainingSamples,
    testSamples: SCALAR_MODEL.validation.testSamples,
    validation: SCALAR_MODEL.validation.states,
  },
  assets: {
    glb: {
      path: '/models/busbar-joule-heating/busbar-default.glb',
      bytes: first.binary.length,
      sha256: sha(first.binary),
      compression: 'EXT_meshopt_compression; 16-bit positions',
    },
    posterWebp: { ...rendering.large },
    posterWebp800: { ...rendering.small },
    posterWebp480: { ...rendering.phone },
  },
  toolchain: {
    node: process.versions.node,
    three: '0.186.1',
    gltfTransform: '4.2.1',
    meshoptimizer: '0.23.0',
    renderer: 'Three.js + Playwright Chromium',
    femPython: 'see src/components/lab/busbar-joule-heating/model/fem/requirements.txt',
  },
};
const manifestBytes = Buffer.from(
  await format(JSON.stringify(manifest), { parser: 'json', printWidth: 100 }),
);
if (first.binary.length + manifestBytes.length > 1_500_000)
  throw new Error('GLB + manifest exceeds 1.5 MB');
await writeFile(path.join(publicDir, 'model-manifest.json'), manifestBytes);
const report = {
  status: 'passed',
  glbBytes: first.binary.length,
  rawBytes: first.rawBytes,
  manifestBytes: manifestBytes.length,
  geometrySha256: first.geometrySha256,
  glbSha256: sha(first.binary),
  rendering: {
    large: rendering.large.bytes,
    small: rendering.small.bytes,
    browser: rendering.browserVersion,
  },
  defaultCase: first.defaultCase,
};
if (evidence)
  await writeFile(
    path.join(evidence, 'model-generation.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
console.log(JSON.stringify(report, null, 2));
