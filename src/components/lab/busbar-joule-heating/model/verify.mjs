// pnpm model:lab:verify busbar-joule-heating [--evidence <dir>] [--fem]
// Actual reproduction: GLB rebuilt twice and compared byte-for-byte with the committed asset;
// the exported surrogate is re-evaluated in Node on every FEM test sample in samples.csv and
// its recorded errors are recomputed; analytic/convergence reports are checked against limits.
// Hash-only: source files, FEM data and WebP previews (raster identity across GPUs not claimed).
// --fem additionally re-solves committed FEM samples with Python (needs numpy/scipy, $PYTHON).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildBusbar, publicDir, root } from './build.mjs';
import { DATA_FILES, SOURCE_FILES } from './sources.mjs';
import { caseQuantities, SCALAR_MODEL } from '../evaluator.ts';
import { createBusbarGeometry, L1_PARAMETERS } from '../geometry.ts';

const expectedNode = (await readFile(path.join(root, '.node-version'), 'utf8')).trim();
assert.equal(process.versions.node, expectedNode, `Use the pinned Node ${expectedNode}`);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const femDir = path.join(root, 'src/components/lab/busbar-joule-heating/model/fem');
const manifest = JSON.parse(await readFile(path.join(publicDir, 'model-manifest.json'), 'utf8'));

// 1. Hash bindings (sources, FEM data, surrogate and image assets).
for (const name of SOURCE_FILES)
  assert.equal(
    sha(await readFile(path.join(root, name))),
    manifest.reproducibility.sourceSha256[name],
    `Source ${name}`,
  );
for (const name of DATA_FILES)
  assert.equal(
    sha(await readFile(path.join(root, name))),
    manifest.reproducibility.femDataSha256[name],
    `Data ${name}`,
  );
for (const item of [...manifest.surrogate.assets, ...Object.values(manifest.assets)]) {
  const bytes = await readFile(path.join(root, 'public', item.path));
  assert.equal(bytes.length, item.bytes, `${item.path} bytes`);
  assert.equal(sha(bytes), item.sha256, `${item.path} SHA-256`);
}
const l1Sha = sha(await readFile(path.join(root, 'model/l1-half-bridge/params.json')));
assert.equal(l1Sha, SCALAR_MODEL.l1ParamsSha256, 'Surrogate trained on the current L1 params.json');

// 2. Geometry rule: nominal dimensions come from L1.
const nominal = createBusbarGeometry();
const plate = nominal.conductors['p-layer'].boxes[0];
assert.equal(plate.max[0] - plate.min[0], L1_PARAMETERS.busbarLength);
assert.equal(plate.max[1] - plate.min[1], L1_PARAMETERS.busbarOverlapWidth);
assert.equal(plate.min[2], L1_PARAMETERS.pBusbarBottom);
assert.equal(nominal.levels.nCollectorBottom, L1_PARAMETERS.slCollectorBottom);

// 3. Rebuild the GLB twice and compare with the committed bytes.
const first = await buildBusbar();
const second = await buildBusbar();
assert.ok(first.binary.equals(second.binary), 'Repeated GLB identical');
assert.equal(first.geometrySha256, manifest.reproducibility.geometrySha256, 'Recorded geometry');
assert.equal(sha(first.binary), manifest.assets.glb.sha256, 'Regenerated GLB equals asset');
assert.ok(first.binary.length <= 1_500_000, 'GLB <= 1.5 MB');

// 4. Re-evaluate the exported surrogate on the independent FEM test samples.
const csv = (await readFile(path.join(femDir, 'data/samples.csv'), 'utf8')).trim().split('\n');
const header = csv[0].split(',');
const rows = csv
  .slice(1)
  .map((line) => Object.fromEntries(line.split(',').map((v, i) => [header[i], v])));
const errors = { resistance: [], theta: [] };
for (const row of rows.filter((r) => r.split === 'test')) {
  const t = Number(row.thickness_mm);
  const b = Number(row.strap_width_mm);
  const predicted = caseQuantities(SCALAR_MODEL, row.case, t, b, Number(row.beta_per_m));
  errors.resistance.push(Math.abs(predicted.resistanceG / Number(row.resistance_g_per_m) - 1));
  errors.theta.push(Math.abs(predicted.thetaMax / Number(row.theta_max) - 1));
}
const summary = (values) => ({
  n: values.length,
  mean: values.reduce((a, v) => a + v, 0) / values.length,
  max: Math.max(...values),
});
const surrogate = { resistanceG: summary(errors.resistance), thetaMax: summary(errors.theta) };
assert.ok(
  surrogate.resistanceG.max < 0.02,
  `Surrogate R_g test error ${surrogate.resistanceG.max}`,
);
assert.ok(
  surrogate.thetaMax.max < 0.05,
  `Surrogate Theta_max test error ${surrogate.thetaMax.max}`,
);

// 5. Analytic and convergence reports.
const analytic = JSON.parse(
  await readFile(path.join(femDir, 'reports/analytic-validation.json'), 'utf8'),
);
assert.equal(analytic.status, 'passed');
assert.ok(analytic.worst_relative_error < 0.02);
const convergence = JSON.parse(
  await readFile(path.join(femDir, 'reports/mesh-convergence.json'), 'utf8'),
);
for (const item of convergence.cases)
  assert.ok(item.resistance.production_change_vs_finest <= 0.005, item.case);

// 6. Optional: re-solve committed FEM samples (actual FEM reproduction).
let fem = 'not requested (--fem)';
if (process.argv.includes('--fem')) {
  const python = process.env.PYTHON || 'python3';
  const run = spawnSync(python, [path.join(femDir, 'reproduce.py')], {
    cwd: femDir,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  fem = JSON.parse(run.stdout.trim().split('\n').at(-1));
}

const report = {
  status: 'passed',
  actualReproduction: {
    glbRebuiltTwiceAndMatchesCommitted: true,
    surrogateReevaluatedOnFemTestSamples: surrogate,
    nominalGeometryFromL1: true,
    fem,
  },
  hashOnly: ['source files', 'FEM data files', 'surrogate assets', 'WebP previews'],
  glbSha256: sha(first.binary),
  l1ParamsSha256: l1Sha,
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
