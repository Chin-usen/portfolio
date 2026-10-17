import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Box3, DoubleSide, Raycaster, Vector3 } from 'three';
import { createRobotJointAssembly } from '../geometry.ts';
const assembly = createRobotJointAssembly();
assembly.scene.rotation.set(0, 0, 0);
assembly.scene.scale.setScalar(1);
assembly.scene.updateMatrixWorld(true);
const ray = new Raycaster();
const initial = [
  new Vector3(0.727, 0.421, 0.543).normalize(),
  new Vector3(-0.439, 0.853, 0.281).normalize(),
];
const dirs = initial.flatMap((d) => [d, d.clone().negate()]);
const boxes = assembly.parts.map((p) => new Box3().setFromObject(p.mesh));
for (const p of assembly.parts) p.mesh.material.side = DoubleSide;
const overlaps = [];
let points = 0,
  raycasts = 0;
function inside(point, mesh) {
  for (const direction of dirs) {
    ray.set(point, direction);
    raycasts++;
    const hits = ray.intersectObject(mesh, false);
    if (hits.some((h) => h.distance < 0.001)) return false;
    const distances = [];
    for (const hit of hits)
      if (!distances.some((d) => Math.abs(d - hit.distance) < 0.00001))
        distances.push(hit.distance);
    if (distances.length % 2 === 0) return false;
  }
  return true;
}
try {
  for (let i = 0; i < assembly.parts.length; i++) {
    const part = assembly.parts[i],
      g = part.mesh.geometry,
      p = g.getAttribute('position'),
      count = (g.index?.count ?? p.count) / 3;
    for (let j = 0; j < assembly.parts.length; j++) {
      if (i === j || part.partId === assembly.parts[j].partId || !boxes[i].intersectsBox(boxes[j]))
        continue;
      let found = false;
      for (let sample = 0; sample < Math.min(count, 192) && !found; sample++) {
        const tri = Math.floor(((sample + 0.5) * count) / Math.min(count, 192));
        const point = new Vector3();
        for (let k = 0; k < 3; k++)
          point.add(
            new Vector3().fromBufferAttribute(p, g.index?.getX(tri * 3 + k) ?? tri * 3 + k),
          );
        point.multiplyScalar(1 / 3).add(part.mesh.position);
        points++;
        if (boxes[j].containsPoint(point) && inside(point, assembly.parts[j].mesh)) {
          overlaps.push({
            surface: part.id,
            inside: assembly.parts[j].id,
            pointMm: point.toArray(),
          });
          found = true;
        }
      }
    }
  }
  const report = {
    status: overlaps.length ? 'failed' : 'passed',
    method:
      'Deterministic sampled triangle-centroid interior test using two independent bidirectional double-sided parity rays in mm coordinates; exact contacts excluded within 0.001 mm; same-semantic component joins excluded',
    scope:
      'Sampling evidence, not exhaustive collision detection or manufacturing tolerance validation',
    sampledPoints: points,
    raycasts,
    overlaps,
    sourceSha256: createHash('sha256')
      .update(await readFile(new URL('../geometry.ts', import.meta.url)))
      .digest('hex'),
  };
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (overlaps.length) process.exitCode = 1;
} finally {
  assembly.dispose();
}
