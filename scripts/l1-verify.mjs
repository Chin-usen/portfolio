import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { buildL1 } from './l1-build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await readFile(path.join(root, 'public/models/l1/model-manifest.json'));
const manifest = JSON.parse(manifestBytes);
const glb = await readFile(path.join(root, 'public/models/l1/half-bridge.glb'));
const webp = await readFile(path.join(root, 'public/images/l1/half-bridge-exploded.webp'));
const responsiveWebp = await readFile(
  path.join(root, 'public/images/l1/half-bridge-exploded-640.webp'),
);
assert.equal(sha(glb), manifest.assets.glb.sha256, 'Committed GLB hash');
assert.equal(glb.length, manifest.assets.glb.bytes, 'Committed GLB size');
assert.equal(sha(webp), manifest.assets.explodedWebp.sha256, 'Committed WebP hash');
assert.equal(webp.length, manifest.assets.explodedWebp.bytes, 'Committed WebP size');
assert.equal(webp.subarray(8, 12).toString(), 'WEBP', 'Actual WebP container');
assert.equal(sha(responsiveWebp), manifest.assets.explodedWebp640.sha256, 'Responsive WebP hash');
assert.equal(responsiveWebp.length, manifest.assets.explodedWebp640.bytes, 'Responsive WebP size');
assert.equal(responsiveWebp.subarray(0, 4).toString(), 'RIFF', 'Responsive RIFF container');
assert.equal(responsiveWebp.subarray(8, 12).toString(), 'WEBP', 'Responsive WebP container');
assert.equal(manifest.assets.explodedWebp640.width, 640, 'Responsive width');
assert.equal(manifest.assets.explodedWebp640.height, 560, 'Responsive height');
assert.ok(glb.length + manifestBytes.length <= 1_500_000, 'Total model payload <= 1.5 MB');
for (const [filename, expected] of Object.entries(manifest.reproducibility.sourceSha256))
  assert.equal(
    sha(await readFile(path.join(root, filename))),
    expected,
    `Source binding: ${filename}`,
  );
const first = await buildL1();
const second = await buildL1();
assert.equal(first.geometrySha256, second.geometrySha256, 'Repeat generated geometry');
assert.equal(
  first.geometrySha256,
  manifest.reproducibility.geometrySha256,
  'Committed geometry binding',
);
assert.equal(sha(first.binary), sha(second.binary), 'Repeat generated GLB');
assert.equal(sha(first.binary), sha(glb), 'Regenerated GLB equals checked-in asset');
assert.equal(first.exportedNodeCount, manifest.parts.length, 'Compressed GLB nodes preserved');
const report = {
  status: 'passed',
  geometryRegeneratedTwice: true,
  repeatedGeometryEqual: true,
  repeatedGlbEqual: true,
  matchesCommittedGlb: true,
  committedWebpHashVerified: true,
  committedResponsiveWebpHashVerified: true,
  imageScope:
    'Verifies both checked-in WebP assets against manifest. Does not require a different OS/GPU/Chromium to reproduce pixel-identical raster bytes.',
  geometrySha256: first.geometrySha256,
  glbSha256: sha(glb),
  webpSha256: sha(webp),
  responsiveWebpSha256: sha(responsiveWebp),
  responsiveWebpBytes: responsiveWebp.length,
  manifestSha256: sha(manifestBytes),
  totalModelPayloadBytes: glb.length + manifestBytes.length,
  nodeCount: first.exportedNodeCount,
  geometryValidation: first.validation,
};
const evidenceArg = process.argv.indexOf('--evidence');
if (evidenceArg >= 0) {
  const directory = path.resolve(process.argv[evidenceArg + 1]);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'asset-verification.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify(
    {
      status: report.status,
      geometryRegeneratedTwice: true,
      matchesCommittedGlb: true,
      nodeCount: report.nodeCount,
      totalModelPayloadBytes: report.totalModelPayloadBytes,
      glbSha256: report.glbSha256,
      webpSha256: report.webpSha256,
      responsiveWebpSha256: report.responsiveWebpSha256,
      responsiveWebpBytes: report.responsiveWebpBytes,
    },
    null,
    2,
  ),
);
