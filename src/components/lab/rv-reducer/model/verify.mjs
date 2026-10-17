import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildRv } from './build.mjs';
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const output = path.join(root, 'public/models/rv-reducer');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await readFile(path.join(output, 'model-manifest.json'));
const manifest = JSON.parse(manifestBytes);
for (const [name, expected] of Object.entries(manifest.reproducibility.sourceSha256))
  assert.equal(hash(await readFile(path.join(root, name))), expected, `Source binding ${name}`);
for (const [kind, asset] of Object.entries(manifest.assets)) {
  const bytes = await readFile(path.join(root, 'public', asset.path));
  assert.equal(bytes.length, asset.bytes, `${kind} bytes`);
  assert.equal(hash(bytes), asset.sha256, `${kind} SHA256`);
  if (kind !== 'glb') {
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
  }
}
const first = await buildRv(),
  second = await buildRv();
assert.equal(first.geometrySha256, second.geometrySha256, 'Repeated geometry');
assert.equal(first.geometrySha256, manifest.reproducibility.geometrySha256, 'Recorded geometry');
assert.equal(hash(first.binary), hash(second.binary), 'Repeated compressed GLB');
assert.equal(hash(first.binary), manifest.assets.glb.sha256, 'Regenerated GLB equals asset');
assert.equal(first.nodeCount, manifest.parts.length, 'Named component nodes retained');
assert.ok(first.binary.length + manifestBytes.length <= 1_500_000, 'GLB + manifest <= 1.5 MB');
const report = {
  status: 'passed',
  geometryRegeneratedTwice: true,
  repeatedGeometryEqual: true,
  repeatedGlbEqual: true,
  matchesCommittedGlb: true,
  webpHashesVerified: true,
  rasterScope:
    'Committed actual render verified by hash; independent GPU/browser pixel identity not claimed',
  nodeCount: first.nodeCount,
  triangles: first.triangles,
  totalModelPayloadBytes: first.binary.length + manifestBytes.length,
  glbSha256: hash(first.binary),
  manifestSha256: hash(manifestBytes),
};
const index = process.argv.indexOf('--evidence');
if (index >= 0) {
  const evidence = path.resolve(process.argv[index + 1]);
  await mkdir(evidence, { recursive: true });
  await writeFile(
    path.join(evidence, 'asset-verification.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(JSON.stringify(report, null, 2));
