/** Generic parametric pin-fin cold plate. Illustrative geometry, simplified; units are mm.
 * Three.js axes: +X along the coolant flow (footprint length), +Y normal to the base,
 * +Z across the flow (footprint width). The base top surface lies at y = 0.
 * No vendor product is reproduced; manifold and cover proportions are teaching values.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pinLayout } from './layout.ts';
import { BASE_THICKNESS_MM, type PinFinParams } from './parameters.ts';

export const PART_IDS = [
  'base-plate',
  'pin-array',
  'cover',
  'inlet-manifold',
  'outlet-manifold',
] as const;
export type PartId = (typeof PART_IDS)[number];

const COVER_MM = 2;
const MANIFOLD_MM = 10;
const WALL_MM = 2;

export const PART_COLORS: Record<PartId, number> = {
  'base-plate': 0xb87333,
  'pin-array': 0xc8834a,
  cover: 0x9fb4c8,
  'inlet-manifold': 0x5e8bb8,
  'outlet-manifold': 0xd9864e,
};
const ALUMINIUM = { 'base-plate': 0xa7adb5, 'pin-array': 0xc3c8cf } as const;

export interface PinFinPart {
  id: PartId;
  mesh:
    | Mesh<BufferGeometry, MeshStandardMaterial>
    | InstancedMesh<BufferGeometry, MeshStandardMaterial>;
}
export interface PinFinAssembly {
  group: Group;
  parts: PinFinPart[];
  pinCount: number;
  dispose(): void;
}

function material(id: PartId, params: PinFinParams): MeshStandardMaterial {
  const metal = id === 'base-plate' || id === 'pin-array';
  const color =
    params.material === 'aluminium' && metal
      ? ALUMINIUM[id as keyof typeof ALUMINIUM]
      : PART_COLORS[id];
  const result = new MeshStandardMaterial({
    color,
    metalness: metal ? 0.55 : 0.05,
    roughness: metal ? 0.38 : 0.55,
  });
  if (id === 'cover') {
    result.transparent = true;
    result.opacity = 0.22;
    result.depthWrite = false;
  }
  result.name = `${id}-material`;
  return result;
}

/** Cover plus two side walls, as one closed lid shell over the pin field. */
function coverGeometry(params: PinFinParams): BufferGeometry {
  const lid = new BoxGeometry(params.length, COVER_MM, params.width + 2 * WALL_MM).translate(
    0,
    params.height + COVER_MM / 2,
    0,
  );
  const wallA = new BoxGeometry(params.length, params.height, WALL_MM).translate(
    0,
    params.height / 2,
    params.width / 2 + WALL_MM / 2,
  );
  const wallB = wallA.clone().translate(0, 0, -params.width - WALL_MM);
  const merged = mergeGeometries([lid, wallA, wallB]);
  lid.dispose();
  wallA.dispose();
  wallB.dispose();
  return merged;
}

function manifoldGeometry(params: PinFinParams, side: -1 | 1): BufferGeometry {
  const total = params.height + COVER_MM;
  const box = new BoxGeometry(MANIFOLD_MM, total, params.width + 2 * WALL_MM).translate(
    side * (params.length / 2 + MANIFOLD_MM / 2),
    total / 2,
    0,
  );
  const portRadius = Math.min(params.width / 6, 5);
  const port = new CylinderGeometry(portRadius, portRadius, 10, 24)
    .rotateZ(Math.PI / 2)
    .translate(side * (params.length / 2 + MANIFOLD_MM + 5), total / 2, 0);
  const merged = mergeGeometries([box.toNonIndexed(), port.toNonIndexed()]);
  box.dispose();
  port.dispose();
  return merged;
}

/**
 * Builds the assembly. `instanced` uses one InstancedMesh for the pins (browser); otherwise the
 * pins are merged into one named mesh (glTF export).
 */
export function createPinFinAssembly(
  params: PinFinParams,
  options: { instanced: boolean; radialSegments?: number },
): PinFinAssembly {
  const group = new Group();
  group.name = 'generic-pin-fin-cold-plate';
  group.userData = { units: 'mm', illustrative: true };
  const layout = pinLayout(params);
  const parts: PinFinPart[] = [];
  const geometries: BufferGeometry[] = [];
  const materials: MeshStandardMaterial[] = [];
  const add = (id: PartId, geometry: BufferGeometry) => {
    const mat = material(id, params);
    geometries.push(geometry);
    materials.push(mat);
    const mesh = new Mesh(geometry, mat);
    mesh.name = id;
    mesh.userData = { partId: id };
    group.add(mesh);
    parts.push({ id, mesh });
    return mesh;
  };

  add(
    'base-plate',
    new BoxGeometry(
      params.length + 2 * MANIFOLD_MM,
      BASE_THICKNESS_MM,
      params.width + 2 * WALL_MM,
    ).translate(0, -BASE_THICKNESS_MM / 2, 0),
  );

  const r = params.diameter / 2;
  const segments = options.radialSegments ?? 20;
  const pin = new CylinderGeometry(r, r, params.height, segments, 1, false).translate(
    0,
    params.height / 2,
    0,
  );
  const matrix = new Matrix4();
  const at = (index: number) =>
    matrix.makeTranslation(
      layout.centres[index * 2 + 1]! - params.length / 2,
      0,
      layout.centres[index * 2]! - params.width / 2,
    );
  if (options.instanced) {
    const mat = material('pin-array', params);
    geometries.push(pin);
    materials.push(mat);
    const mesh = new InstancedMesh(pin, mat, Math.max(1, layout.count));
    mesh.count = layout.count;
    for (let index = 0; index < layout.count; index += 1) mesh.setMatrixAt(index, at(index));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.name = 'pin-array';
    mesh.userData = { partId: 'pin-array' };
    group.add(mesh);
    parts.push({ id: 'pin-array', mesh });
  } else {
    const copies: BufferGeometry[] = [];
    for (let index = 0; index < layout.count; index += 1)
      copies.push(pin.clone().applyMatrix4(at(index)));
    const merged = copies.length ? mergeGeometries(copies) : pin.clone();
    for (const copy of copies) copy.dispose();
    pin.dispose();
    add('pin-array', merged);
  }
  add('cover', coverGeometry(params));
  add('inlet-manifold', manifoldGeometry(params, -1));
  add('outlet-manifold', manifoldGeometry(params, 1));

  let disposed = false;
  return {
    group,
    parts,
    pinCount: layout.count,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const mat of materials) mat.dispose();
      for (const part of parts) if (part.mesh instanceof InstancedMesh) part.mesh.dispose();
      group.clear();
    },
  };
}
