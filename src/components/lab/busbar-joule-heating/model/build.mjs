// Builds the nominal S2 conductor scene (default case field baked into vertex colours) as a
// compressed GLB. Geometry comes from geometry.ts, i.e. from the L1 parameter file.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { CONDUCTOR_IDS, createBusbarGeometry, latticeOffsets } from '../geometry.ts';
import { evaluate, SCALAR_MODEL } from '../evaluator.ts';
import { createFieldEvaluator, decodeFloat16 } from '../field.ts';
import { DEFAULT_PARAMS } from '../parameters.ts';
import {
  boltPlacement,
  buildBoxSurface,
  fieldRange,
  PALETTES,
  paletteIndex,
  sampleSurface,
} from '../viewer-shared.ts';

export const root = fileURLToPath(new URL('../../../../../', import.meta.url));
export const publicDir = path.join(root, 'public/models/busbar-joule-heating');

class BinaryFileReader {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      })
      .catch((error) => this.onerror?.(error));
  }
}
globalThis.FileReader ??= BinaryFileReader;
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});

const CONTEXT_COLORS = {
  ceramic: [0.86, 0.86, 0.84],
  'drain-island': [0.7, 0.66, 0.6],
  die: [0.23, 0.25, 0.28],
  clip: [0.62, 0.64, 0.66],
};
const linear = (value) =>
  value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);

function edgesOf(boxes) {
  const out = [];
  for (const { min, max } of boxes) {
    const c = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => [
      n & 1 ? max[0] : min[0],
      n & 2 ? max[1] : min[1],
      n & 4 ? max[2] : min[2],
    ]);
    for (const [a, b] of [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [0, 2],
      [1, 3],
      [4, 6],
      [5, 7],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ])
      for (const p of [c[a], c[b]]) out.push(p[0], p[2], -p[1]);
  }
  return out;
}

function mergeBolt(bolt) {
  const washer = new CylinderGeometry(bolt.washerRadius, bolt.washerRadius, 0.6, 28)
    .rotateX(Math.PI / 2)
    .translate(bolt.x, bolt.height, bolt.washerZ);
  const shaft = new CylinderGeometry(bolt.shaftRadius, bolt.shaftRadius, bolt.shaftLength, 20)
    .rotateX(Math.PI / 2)
    .translate(bolt.x, bolt.height, bolt.shaftZ);
  const merged = mergeGeometries([washer.toNonIndexed(), shaft.toNonIndexed()]);
  merged.deleteAttribute('uv');
  merged.deleteAttribute('normal');
  washer.dispose();
  shaft.dispose();
  return merged;
}

function meshFromSurfaces(surfaces, colorOf) {
  const vertexCount = surfaces.reduce((sum, s) => sum + s.shade.length, 0);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices = [];
  let base = 0;
  surfaces.forEach((surface, surfaceIndex) => {
    positions.set(surface.positions, base * 3);
    for (let v = 0; v < surface.shade.length; v += 1) {
      const rgb = colorOf(surfaceIndex, v, surface);
      colors.set(rgb, (base + v) * 3);
    }
    for (const index of surface.indices) indices.push(index + base);
    base += surface.shade.length;
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

export async function loadDefaultField() {
  const field = JSON.parse(await readFile(path.join(publicDir, 'field-model.json'), 'utf8'));
  const basis = await readFile(path.join(publicDir, 'field-basis.f16'));
  const evaluator = createFieldEvaluator(
    SCALAR_MODEL,
    field,
    decodeFloat16(basis.buffer.slice(basis.byteOffset, basis.byteOffset + basis.byteLength)),
  );
  const params = { ...DEFAULT_PARAMS };
  const result = evaluate(params);
  return { params, result, fields: evaluator(params, result) };
}

export async function buildBusbar() {
  const { params, result, fields } = await loadDefaultField();
  const geometry = createBusbarGeometry({
    thicknessMm: params.thickness,
    strapWidthMm: params.strapWidth,
  });
  const state = { params, result, geometry, fields };
  const range = fieldRange(state, 'temperature');
  const lut = PALETTES.temperature.linear;
  const scene = new Group();
  scene.name = 'busbar-joule-heating';
  // Source mm (three frame) -> metres for the exported asset.
  scene.scale.setScalar(0.001);
  const materials = [];
  const geometries = [];
  const hash = createHash('sha256');
  for (const id of CONDUCTOR_IDS) {
    const conductor = geometry.conductors[id];
    const offsets = latticeOffsets(conductor);
    const surfaces = conductor.boxes.map((item, index) => buildBoxSurface(item, offsets[index]));
    const field = fields[id];
    const scratch = surfaces.map((surface) => new Float32Array(surface.shade.length));
    surfaces.forEach((surface, index) => {
      if (field) sampleSurface(surface, field.rise, scratch[index]);
    });
    const active = result.conductors[id].active;
    const mesh = new Mesh(
      meshFromSurfaces(surfaces, (surfaceIndex, v, surface) => {
        const shade = surface.shade[v];
        if (!active || !field) return [0.6, 0.62, 0.65].map((c) => linear(c * (0.6 + 0.4 * shade)));
        const k = paletteIndex(params.tSub + scratch[surfaceIndex][v], range) * 3;
        return [0, 1, 2].map((axis) => lut[k + axis] * (0.7 + 0.3 * shade));
      }),
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: !active,
        opacity: active ? 1 : 0.28,
      }),
    );
    mesh.name = id;
    mesh.userData = { partId: id, active, state: params.state, field: 'temperature' };
    const edges = new LineSegments(
      new BufferGeometry().setAttribute(
        'position',
        new Float32BufferAttribute(edgesOf(conductor.boxes), 3),
      ),
      new LineBasicMaterial({ color: 0x7b8090 }),
    );
    edges.name = `${id}-edges`;
    scene.add(mesh, edges);
    const bolt = boltPlacement(conductor);
    if (bolt) {
      const boltGeometry = mergeBolt(bolt);
      const boltMesh = new Mesh(boltGeometry, new MeshBasicMaterial({ color: 0x8e9399 }));
      boltMesh.name = `${id}-bolt`;
      boltMesh.userData = { partId: id, role: 'terminal-bolt' };
      scene.add(boltMesh);
      materials.push(boltMesh.material);
      geometries.push(boltGeometry);
    }
    materials.push(mesh.material, edges.material);
    geometries.push(mesh.geometry, edges.geometry);
  }
  const contextSurfaces = geometry.context.map((item) =>
    buildBoxSurface(
      { id: item.id, role: 'plate', min: item.min, max: item.max, lattice: [1, 1, 1] },
      0,
    ),
  );
  const context = new Mesh(
    meshFromSurfaces(contextSurfaces, (surfaceIndex, v, surface) => {
      const base = CONTEXT_COLORS[geometry.context[surfaceIndex].kind];
      return base.map((c) => linear(c * (0.55 + 0.45 * surface.shade[v])));
    }),
    new MeshBasicMaterial({ vertexColors: true }),
  );
  context.name = 'context';
  context.userData = { partId: 'context', solved: false };
  scene.add(context);
  materials.push(context.material);
  geometries.push(context.geometry);
  scene.updateMatrixWorld(true);
  for (const object of scene.children) {
    const g = object.geometry;
    hash.update(object.name);
    const position = g.getAttribute('position').array;
    hash.update(Buffer.from(position.buffer, position.byteOffset, position.byteLength));
    const color = g.getAttribute('color')?.array;
    if (color) hash.update(Buffer.from(color.buffer, color.byteOffset, color.byteLength));
  }
  try {
    const raw = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: false });
    const document = await io.readBinary(new Uint8Array(raw));
    await document.transform(
      dedup(),
      weld(),
      meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16 }),
    );
    const binary = Buffer.from(await io.writeBinary(document));
    const decoded = await io.readBinary(binary);
    const names = decoded
      .getRoot()
      .listNodes()
      .filter((node) => node.getMesh())
      .map((node) => node.getName())
      .sort();
    const expected = [
      ...CONDUCTOR_IDS,
      ...CONDUCTOR_IDS.map((id) => `${id}-edges`),
      ...CONDUCTOR_IDS.map((id) => `${id}-bolt`),
      'context',
    ].sort();
    if (JSON.stringify(names) !== JSON.stringify(expected))
      throw new Error(`Named nodes lost: ${names}`);
    return {
      binary,
      rawBytes: raw.byteLength,
      geometrySha256: hash.digest('hex'),
      nodeNames: names,
      defaultCase: {
        params,
        tMaxC: result.tMax,
        lossW: result.loss,
        resistanceMilliohm: result.resistance * 1e3,
        temperatureRangeC: [range.min, range.max],
      },
    };
  } finally {
    for (const item of [...materials, ...geometries]) item.dispose();
  }
}
