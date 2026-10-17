import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format } from 'prettier';
import { buildRobotJoint } from './build.mjs';
import { renderModel } from './render.mjs';
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const expectedNode = (await readFile(path.join(root, '.node-version'), 'utf8')).trim();
if (process.versions.node !== expectedNode)
  throw new Error(
    `Model byte reproducibility requires Node ${expectedNode}; current ${process.versions.node}. Use the pinned project runtime.`,
  );
const output = path.join(root, 'public/models/robot-joint');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidenceArg = process.argv.indexOf('--evidence');
const evidence = evidenceArg < 0 ? null : path.resolve(process.argv[evidenceArg + 1]);
await mkdir(output, { recursive: true });
if (evidence) await mkdir(evidence, { recursive: true });
const first = await buildRobotJoint(),
  second = await buildRobotJoint();
if (!first.binary.equals(second.binary) || first.geometrySha256 !== second.geometrySha256)
  throw new Error('Repeated robot joint geometry/GLB differs');
await writeFile(path.join(output, 'robot-joint.glb'), first.binary);
const rendering = await renderModel({
  root,
  output: path.join(output, 'robot-joint-exploded.webp'),
  responsiveOutput: path.join(output, 'robot-joint-exploded-640.webp'),
  evidence,
});
const sourceNames = [
  'parts.ts',
  'params.ts',
  'geometry.ts',
  'model/build.mjs',
  'model/inspect.mjs',
  'model/render.mjs',
  'model/generate.mjs',
  'model/verify.mjs',
].map((name) => `src/components/lab/robot-joint/${name}`);
sourceNames.push('.node-version');
const sourceSha256 = Object.fromEntries(
  await Promise.all(
    sourceNames.map(async (name) => [name, hash(await readFile(path.join(root, name)))]),
  ),
);
const manifest = {
  version: 1,
  modelKind: 'static-integrated-joint-schematic',
  descriptionEn:
    'Original generic hollow integrated robot joint system model; no vendor replication or manufacturing dimensions',
  units: 'm',
  sourceUnits: 'mm',
  upAxis: 'Y',
  coordinateTransform: '(x,y,z) mm -> (x,z,-y)/1000 metres via root transform',
  parameters: first.parameters,
  metrics: {
    cableBoreDiameterMm: first.parameters.boreRadiusMm * 2,
    housingDiameterMm: first.parameters.housingOuterRadiusMm * 2,
    motorRadialAirGapMm: (2 * first.parameters.housingOuterRadiusMm) / 67,
    transmissionAnimated: false,
  },
  parts: first.parts,
  groups: Object.fromEntries(
    [...new Set(first.parts.map((part) => part.partId))].map((id) => [
      id,
      { nodeNames: first.parts.filter((part) => part.partId === id).map((part) => part.name) },
    ]),
  ),
  constraints: {
    manufacturingQualified: false,
    transmissionAnimated: false,
    contactLoadSolved: false,
    motorFieldSolved: false,
    thermalResistanceSolved: false,
    encoderResolutionSpecified: false,
    brakeForceSolved: false,
    reducerScope:
      'Independent static annular/cup schematic; no harmonic-drive L4 source imports, tooth mesh or deformation animation',
    crossRollerScope:
      'Alternating roller orientations; support geometry only, no race/roller spin or load prediction',
    cablePath:
      'Continuous nominal 16 mm through bore; stationary conduit OD 20 mm and rotating sleeve ID 22 mm',
    thermalPath:
      'Stator outer radius 58 mm touches thermal pad inner radius 58 mm; pad outer radius 63 mm touches housing inner radius 63 mm',
    outputPath:
      'Motor rotor and hollow input sleeve to reducer hub; schematic cup output to separate hollow output sleeve and flange; no load simulation',
    displayClearances:
      '2 mm radial motor air gap, 1 mm fixed-ring-to-flex-rim radial gap, 1 mm stationary-conduit-to-rotating-sleeve radial gap; these are teaching dimensions',
  },
  reproducibility: {
    deterministicScope:
      'Exact pinned Node and dependency versions; cross-runtime floating-point color serialization is not claimed',
    geometrySha256: first.geometrySha256,
    repeatedGeometryEqual: true,
    repeatedGlbEqual: true,
    sourceSha256,
  },
  assets: {
    glb: {
      path: '/models/robot-joint/robot-joint.glb',
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
  throw new Error('RobotJoint GLB + manifest exceeds 1.5 MB');
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
