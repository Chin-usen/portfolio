import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format } from 'prettier';
import { buildRv } from './build.mjs';
import { renderModel } from './render.mjs';
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const output = path.join(root, 'public/models/rv-reducer');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidenceArg = process.argv.indexOf('--evidence');
const evidence = evidenceArg < 0 ? null : path.resolve(process.argv[evidenceArg + 1]);
await mkdir(output, { recursive: true });
if (evidence) await mkdir(evidence, { recursive: true });
const first = await buildRv(),
  second = await buildRv();
if (!first.binary.equals(second.binary) || first.geometrySha256 !== second.geometrySha256)
  throw new Error('Repeated RV geometry/GLB differs');
await writeFile(path.join(output, 'rv-reducer.glb'), first.binary);
const rendering = await renderModel({
  root,
  output: path.join(output, 'rv-reducer-exploded.webp'),
  responsiveOutput: path.join(output, 'rv-reducer-exploded-640.webp'),
  evidence,
});
const sourceNames = [
  'math.ts',
  'params.ts',
  'params.json',
  'geometry.ts',
  'model/build.mjs',
  'model/render.mjs',
  'model/generate.mjs',
  'model/verify.mjs',
].map((name) => `src/components/lab/rv-reducer/${name}`);
const sourceSha256 = Object.fromEntries(
  await Promise.all(
    sourceNames.map(async (name) => [name, hash(await readFile(path.join(root, name)))]),
  ),
);
const manifest = {
  version: 1,
  modelKind: 'parameterized-kinematic-schematic',
  descriptionZh: '通用参数化两级 RV 减速器示意模型，非厂商复原或制造图纸',
  descriptionEn:
    'Generic parameterized two-stage RV schematic, not a vendor reconstruction or manufacturing drawing',
  units: 'm',
  sourceUnits: 'mm',
  upAxis: 'Y',
  coordinateTransform: '(x,y,z) mm -> (x,z,-y)/1000 metres via root transform',
  parameters: first.parameters,
  layout: first.layout,
  metrics: first.metrics,
  parts: first.parts,
  groups: Object.fromEntries(
    [...new Set(first.parts.map((part) => part.partId))].map((id) => [
      id,
      { nodeNames: first.parts.filter((part) => part.partId === id).map((part) => part.name) },
    ]),
  ),
  kinematics: {
    inputToOutputRatio: first.metrics.ratio,
    outputAngle: 'inputAngle / ratio',
    crankAbsoluteAngle: '-lobeCount * outputAngle',
    crankRelativeToCarrierAngle: '-pinCount * outputAngle',
    twinEccentricPhaseRad: Math.PI,
    discBOutlineIndexRad: -Math.PI / first.parameters.lobeCount,
    structuralHoleFrame: 'carrier angle; tooth index is baked into only the outline',
    firstStage: '30 degree unshifted involute flanks; schematic root blends',
    contactScope:
      'Nominal geometric tangency, not force/load sharing or simultaneous no-slip motion of shared pins',
  },
  constraints: {
    manufacturingQualified: false,
    rootFilletGeneratedByCutter: false,
    bearingContactLoadSolved: false,
    normalReliefMm: 0,
    profileChordToleranceMm: first.parameters.profileChordToleranceMm,
  },
  reproducibility: {
    geometrySha256: first.geometrySha256,
    repeatedGeometryEqual: true,
    repeatedGlbEqual: true,
    sourceSha256,
  },
  assets: {
    glb: {
      path: '/models/rv-reducer/rv-reducer.glb',
      bytes: first.binary.length,
      sha256: hash(first.binary),
      compression: 'EXT_meshopt_compression; 16-bit positions / 10-bit normals',
    },
    explodedWebp: { ...rendering.asset, width: 1600, height: 1400 },
    explodedWebp640: rendering.responsive.asset,
  },
  validation: {
    namedIndependentMeshes: first.nodeCount,
    totalTriangles: first.triangles,
    finiteGeometry: true,
    compressedNodeMetadataPreserved: true,
  },
  toolchain: {
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
  throw new Error('RV GLB + manifest exceeds 1.5 MB');
await writeFile(path.join(output, 'model-manifest.json'), manifestBytes);
const report = {
  status: 'passed',
  nodeCount: first.nodeCount,
  triangles: first.triangles,
  rawBytes: first.rawBytes,
  glbBytes: first.binary.length,
  manifestBytes: manifestBytes.length,
  totalModelPayloadBytes: first.binary.length + manifestBytes.length,
  geometrySha256: first.geometrySha256,
  glbSha256: hash(first.binary),
  manifestSha256: hash(manifestBytes),
  rendering,
  sourceSha256,
  repeatedGlbEqual: true,
};
if (evidence)
  await writeFile(
    path.join(evidence, 'model-validation.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
console.log(
  JSON.stringify(
    {
      ...report,
      sourceSha256: undefined,
      rendering: {
        largeBytes: rendering.asset.bytes,
        smallBytes: rendering.responsive.asset.bytes,
        visiblePixels: rendering.visiblePixels,
        browserVersion: rendering.browserVersion,
      },
    },
    null,
    2,
  ),
);
