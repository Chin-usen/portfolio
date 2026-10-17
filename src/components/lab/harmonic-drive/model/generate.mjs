import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format } from 'prettier';
import { buildHarmonic } from './build.mjs';
import { renderModel } from './render.mjs';
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const expectedNode = (await readFile(path.join(root, '.node-version'), 'utf8')).trim();
if (process.versions.node !== expectedNode)
  throw new Error(
    `Model byte reproducibility requires Node ${expectedNode}; current ${process.versions.node}. Use the pinned project runtime.`,
  );
const output = path.join(root, 'public/models/harmonic-drive');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidenceArg = process.argv.indexOf('--evidence');
const evidence = evidenceArg < 0 ? null : path.resolve(process.argv[evidenceArg + 1]);
await mkdir(output, { recursive: true });
if (evidence) await mkdir(evidence, { recursive: true });
const first = await buildHarmonic(),
  second = await buildHarmonic();
if (!first.binary.equals(second.binary) || first.geometrySha256 !== second.geometrySha256)
  throw new Error('Repeated harmonic geometry/GLB differs');
await writeFile(path.join(output, 'harmonic-drive.glb'), first.binary);
const rendering = await renderModel({
  root,
  output: path.join(output, 'harmonic-drive-exploded.webp'),
  responsiveOutput: path.join(output, 'harmonic-drive-exploded-640.webp'),
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
].map((name) => `src/components/lab/harmonic-drive/${name}`);
sourceNames.push('.node-version');
const sourceSha256 = Object.fromEntries(
  await Promise.all(
    sourceNames.map(async (name) => [name, hash(await readFile(path.join(root, name)))]),
  ),
);
const manifest = {
  version: 1,
  modelKind: 'parameterized-kinematic-schematic',
  descriptionEn:
    'Generic cup-type strain-wave teaching model; no vendor replication or manufacturing dimensions',
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
    boundaryCondition:
      'Circular spline fixed; elliptical wave generator input; cup flexspline output',
    outputAngle: 'inputAngle / ratio',
    ratioFormula: '-flexTeeth / (circularTeeth-flexTeeth)',
    nominalDeformationFormulaMm: 'moduleMm * (circularTeeth-flexTeeth) / 2',
    radialDeformation: 'nominalDeformationMm * cos(2*(spatialAzimuth-inputAngle))',
    materialToothAngle: '2*pi*toothIndex/flexTeeth + outputAngle',
    displayDeformationScale: first.parameters.deformationScale,
    engagementDirectionsRad: [0, Math.PI],
  },
  constraints: {
    manufacturingQualified: false,
    conjugateToothProfile: false,
    elasticStrainSolved: false,
    bearingSpinSolved: false,
    contactLoadSolved: false,
    flexProfile: 'Schematic trapezoid teeth; cosine radial wave with cup-base-to-mouth taper',
    waveCam: 'True ellipse with displayed semiaxes plus/minus amplified deformation',
    bearingScope:
      'Thin races and rolling elements visualize the rotating envelope, not individual race/ball kinematics',
    displayClearance:
      'Circular spline is radially offset by (displayAmplitude-nominalAmplitude)+1.6*module to leave at least 0.4*module clearance; amber sectors indicate major-axis engagement regions, not literal solved contact',
    crossRollerScope:
      'Alternating roller axes; support geometry only, no race/roller spin or load prediction',
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
      path: '/models/harmonic-drive/harmonic-drive.glb',
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
  throw new Error('Harmonic GLB + manifest exceeds 1.5 MB');
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
