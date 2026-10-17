import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format } from 'prettier';
import { buildL1 } from './l1-build.mjs';
import { renderModel } from './l1-render.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const evidenceArg = process.argv.indexOf('--evidence');
const evidence = evidenceArg < 0 ? null : path.resolve(process.argv[evidenceArg + 1]);
const out = path.join(root, 'public/models/l1');
const images = path.join(root, 'public/images/l1');
const sourceNames = [
  'model/l1-half-bridge/model.ts',
  'model/l1-half-bridge/validate.ts',
  'model/l1-half-bridge/params.json',
  'scripts/l1-build.mjs',
  'scripts/l1-generate.mjs',
  'scripts/l1-render.mjs',
  'scripts/l1-verify.mjs',
];
await mkdir(out, { recursive: true });
await mkdir(images, { recursive: true });
if (evidence) await mkdir(evidence, { recursive: true });
const first = await buildL1();
const second = await buildL1();
if (!first.binary.equals(second.binary) || first.geometrySha256 !== second.geometrySha256)
  throw new Error('Repeated geometry or compressed binary differs');
await writeFile(path.join(out, 'half-bridge.glb'), first.binary);
const rendering = process.argv.includes('--skip-render')
  ? null
  : await renderModel({
      root,
      output: path.join(images, 'half-bridge-exploded.webp'),
      responsiveOutput: path.join(images, 'half-bridge-exploded-640.webp'),
      evidence,
    });
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourceNames.map(async (name) => [name, sha256(await readFile(path.join(root, name)))]),
  ),
);
const manifest = {
  version: 1,
  modelVersion: first.parameters.version,
  modelKind: 'parameterized-schematic-mesh',
  descriptionZh:
    '\u53c2\u6570\u5316\u793a\u610f\u6a21\u578b\uff08\u51e0\u4f55\u5df2\u7b80\u5316\uff09',
  descriptionEn: 'Parameterized schematic model (simplified geometry)',
  units: 'm',
  upAxis: 'Y',
  sourceUnits: 'mm',
  coordinateTransform: '(x,y,z) mm -> (x,z,-y)/1000 metres',
  defaultPartId: 'busbar',
  parts: first.parts,
  groups: Object.fromEntries(
    Object.entries(first.parameters.explodeOffsetsMm).map(([group, explodeZmm]) => [
      group,
      {
        explodeZmm,
        nodeNames: first.parts.filter((part) => part.partId === group).map((part) => part.name),
      },
    ]),
  ),
  parameters: {
    busbarGapMm: first.parameters.busbarGap,
    busbarGapMinMm: 0.1,
    busbarGapMaxMm: 2,
    overlapWidthMm: first.parameters.busbarOverlapWidth,
    busbarLengthMm: first.parameters.busbarLength,
  },
  controlRanges: { gapMm: [0.1, 2], overlapWidthMm: [10, 60], lengthMm: [40, 140] },
  constraints: {
    qualifiedInsulation: false,
    description:
      'Educational polygonal geometry. Gap motion is schematic; geometric validation establishes nominal routing contacts only, not device performance or manufacturing suitability.',
  },
  topology: first.validation.topology,
  reproducibility: {
    geometrySha256: first.geometrySha256,
    repeatedGeometryEqual: true,
    repeatedGlbEqual: true,
    sourceSha256: sourceHashes,
  },
  assets: {
    glb: {
      path: '/models/l1/half-bridge.glb',
      bytes: first.binary.length,
      sha256: sha256(first.binary),
      compression: 'EXT_meshopt_compression, 16-bit position / 10-bit normal quantization',
    },
    ...(rendering
      ? { explodedWebp: rendering.asset, explodedWebp640: rendering.responsive.asset }
      : {}),
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
  throw new Error('Model payload exceeds 1.5 MB');
await writeFile(path.join(out, 'model-manifest.json'), manifestBytes);
const report = {
  ...first.validation,
  geometrySha256: first.geometrySha256,
  glbSha256: sha256(first.binary),
  manifestSha256: sha256(manifestBytes),
  rawBytes: first.rawBytes,
  glbBytes: first.binary.length,
  manifestBytes: manifestBytes.length,
  totalModelPayloadBytes: first.binary.length + manifestBytes.length,
  repeatedGeometryEqual: true,
  repeatedGlbEqual: true,
  compressedDecodedNodes: first.exportedNodeCount,
  rendering,
  sourceSha256: sourceHashes,
};
if (evidence)
  await writeFile(
    path.join(evidence, 'model-validation.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
console.log(
  JSON.stringify(
    {
      status: report.status,
      nodes: report.nodeCount,
      triangles: report.totalTriangles,
      glbBytes: report.glbBytes,
      totalModelPayloadBytes: report.totalModelPayloadBytes,
      geometryRepeated: true,
      glbRepeated: true,
      rendering,
    },
    null,
    2,
  ),
);
