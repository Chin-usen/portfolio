import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format } from 'prettier';
import { buildAutomotiveCameraLens } from './build.mjs';
import { renderModel } from './render.mjs';
import { ACL_VIEW_DIRECTION } from '../params.ts';
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const expectedNode = (await readFile(path.join(root, '.node-version'), 'utf8')).trim();
if (process.versions.node !== expectedNode)
  throw new Error(
    `Model byte reproducibility requires Node ${expectedNode}; current ${process.versions.node}. Use the pinned project runtime.`,
  );
const slug = 'automotive-camera-lens';
const output = path.join(root, 'public/models', slug);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidenceArg = process.argv.indexOf('--evidence');
const evidence = evidenceArg < 0 ? null : path.resolve(process.argv[evidenceArg + 1]);
await mkdir(output, { recursive: true });
if (evidence) await mkdir(evidence, { recursive: true });
const first = await buildAutomotiveCameraLens(),
  second = await buildAutomotiveCameraLens();
if (!first.binary.equals(second.binary) || first.geometrySha256 !== second.geometrySha256)
  throw new Error('Repeated camera lens geometry/GLB differs');
await writeFile(path.join(output, `${slug}.glb`), first.binary);
const rendering = await renderModel({
  root,
  output: path.join(output, `${slug}-exploded.webp`),
  responsiveOutput: path.join(output, `${slug}-exploded-640.webp`),
  evidence,
  viewDirection: ACL_VIEW_DIRECTION,
});
const sourceNames = [
  'params.json',
  'params.ts',
  'optics.ts',
  'layout.ts',
  'geometry.ts',
  'model/build.mjs',
  'model/render.mjs',
  'model/generate.mjs',
  'model/verify.mjs',
].map((name) => `src/components/lab/${slug}/${name}`);
sourceNames.push('.node-version');
const sourceSha256 = Object.fromEntries(
  await Promise.all(
    sourceNames.map(async (name) => [name, hash(await readFile(path.join(root, name)))]),
  ),
);
const round = (value) => Math.round(value * 1e6) / 1e6;
const manifest = {
  version: 1,
  modelKind: 'illustrative-automotive-camera-lens',
  descriptionEn:
    'Generic six-element automotive camera lens module for teaching; illustrative paraxial prescription, not a real optical design or a vendor product',
  units: 'm',
  sourceUnits: 'mm',
  upAxis: 'Y',
  coordinateTransform:
    'Optical axis z (mm) -> local +x; root rotated about z by the display tilt and scaled 1/1000 to metres',
  optics: {
    method: 'Paraxial y-nu trace with vertex curvatures; conic/A4 terms shape drawn surfaces only',
    prescription: first.optics.prescription,
    metrics: Object.fromEntries(
      Object.entries(first.optics.metrics).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(round) : round(value),
      ]),
    ),
    stopZmm: round(first.optics.stopZmm),
    stopRadiusMm: round(first.optics.stopRadiusMm),
    elements: first.optics.elements.map((element) => ({
      ...element,
      focalLengthMm: round(element.focalLengthMm),
      zFront: round(element.zFront),
      zBack: round(element.zBack),
    })),
  },
  mechanicalLayoutMm: Object.fromEntries(
    Object.entries(first.dims).map(([key, value]) => [key, round(value)]),
  ),
  parts: first.parts,
  groups: Object.fromEntries(
    [...new Set(first.parts.map((part) => part.partId))].map((id) => [
      id,
      { nodeNames: first.parts.filter((part) => part.partId === id).map((part) => part.id) },
    ]),
  ),
  constraints: {
    realOpticalDesign: false,
    manufacturingQualified: false,
    aberrationsSolved: false,
    distortionSolved: false,
    thermalFocusShiftSolved: false,
    toleranceAnalysis: false,
    activeAlignmentProcessModelled: false,
    sensorCoverGlass: 'omitted; active die surface on the paraxial image plane',
    explosion:
      'Groups spread along the optical axis with a 3 mm display gap; lenses leave the barrel through its front',
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
      path: `/models/${slug}/${slug}.glb`,
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
  throw new Error('Camera lens GLB + manifest exceeds 1.5 MB');
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
