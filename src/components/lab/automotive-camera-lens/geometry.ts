/** Generic illustrative automotive camera lens module: Three.js assembly.
 * Geometry is derived from the paraxial prescription (optics.ts) through the shared
 * mechanical layout (layout.ts). Local dimensions are mm with the optical axis on +x
 * (object side at −x); the root scales to metres. Lens surfaces are revolved from their
 * sag profiles; prismatic holder, filter, sensor and PCB parts are boxes or frames.
 * No tolerances, stress, thermal drift, alignment process or image quality are modelled.
 */
import {
  BoxGeometry,
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  TorusGeometry,
  Vector3,
} from 'three';
import type { LensPrescription, OpticalModel } from './optics.ts';
import {
  createCameraLayout,
  explodeOffsets,
  type CameraLayout,
  type LayoutPart,
  type ProfileRun,
} from './layout.ts';
import {
  ACL_DEFAULT_PRESCRIPTION,
  ACL_EXPLODE_GAP_MM,
  ACL_EXPLODE_MODULE_BREAKS,
  ACL_EXPLODE_MODULE_GAP_MM,
  ACL_EXPLODE_ORDER,
  ACL_HIDDEN_IN_OPTICS,
  prepareOptics,
  type AclMode,
  type AclPartId,
} from './params.ts';

export interface AclMeshPart {
  id: string;
  partId: AclPartId;
  group: string;
  explodeOffsetMm: [number, number, number];
  opticsExplodeOffsetMm: [number, number, number] | null;
  mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
}
export interface AclAssembly {
  scene: Group;
  parts: AclMeshPart[];
  optics: OpticalModel;
  layout: CameraLayout;
  update(options?: { mode?: AclMode; separation?: number }): void;
  dispose(): void;
}
const TAU = Math.PI * 2;
/** Display tilt of the optical axis so the exploded train uses both screen dimensions. */
export const ACL_AXIS_TILT_RAD = -0.6;

type Appearance = {
  color: number;
  metalness: number;
  roughness: number;
  opacity?: number;
  material: string;
};
function appearance(part: LayoutPart, prescription: LensPrescription): Appearance {
  const element = prescription.elements.find((item) => item.id === part.id);
  if (element)
    return element.material === 'glass'
      ? { color: 0x7fb0d2, metalness: 0.05, roughness: 0.08, opacity: 0.82, material: 'glass' }
      : { color: 0x96c7a6, metalness: 0.02, roughness: 0.16, opacity: 0.82, material: 'plastic' };
  const table: Record<string, Appearance> = {
    'lens-barrel': { color: 0x3d444c, metalness: 0.35, roughness: 0.5, material: 'metal' },
    spacers: { color: 0x5a6069, metalness: 0.3, roughness: 0.55, material: 'metal' },
    'aperture-stop': { color: 0x24282d, metalness: 0.2, roughness: 0.6, material: 'film' },
    'retaining-ring': { color: 0x6e7782, metalness: 0.55, roughness: 0.38, material: 'metal' },
    'o-ring': { color: 0x2a2e33, metalness: 0, roughness: 0.85, material: 'elastomer' },
    'lens-holder': { color: 0x535a63, metalness: 0.1, roughness: 0.6, material: 'polymer' },
    'ir-cut-filter': {
      color: 0x86a7c9,
      metalness: 0.15,
      roughness: 0.05,
      opacity: 0.6,
      material: 'glass',
    },
    'aa-adhesive': { color: 0xd8a640, metalness: 0, roughness: 0.5, material: 'adhesive' },
    'image-sensor': { color: 0x5d636b, metalness: 0.2, roughness: 0.5, material: 'ceramic' },
    pcb: { color: 0x2f6e58, metalness: 0.1, roughness: 0.55, material: 'laminate' },
  };
  if (part.id === 'sensor-die')
    return { color: 0x4a4686, metalness: 0.45, roughness: 0.25, material: 'silicon' };
  if (part.id === 'pcb-connector')
    return { color: 0xcfc8b8, metalness: 0.1, roughness: 0.5, material: 'polymer' };
  if (part.id === 'pcb-regulator')
    return { color: 0x30343a, metalness: 0.1, roughness: 0.5, material: 'polymer' };
  return table[part.partId]!;
}

/** Revolve clockwise (z, r) runs about the optical axis with explicit outward normals. */
export function revolveRuns(runs: readonly ProfileRun[], segments: number) {
  const cos = Array.from({ length: segments }, (_, j) => Math.cos((TAU * j) / segments));
  const sin = Array.from({ length: segments }, (_, j) => Math.sin((TAU * j) / segments));
  const position: number[] = [];
  const normal: number[] = [];
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3(),
    face = new Vector3();
  for (const run of runs) {
    const points = run.points;
    const edgeNormals = points.slice(1).map((point, index) => {
      const previous = points[index]!;
      const dz = point[0] - previous[0],
        dr = point[1] - previous[1];
      const length = Math.hypot(dz, dr);
      if (!(length > 0)) throw new RangeError('Repeated profile point');
      return [-dr / length, dz / length] as const;
    });
    const vertexNormal = (edge: number, end: 0 | 1) => {
      const own = edgeNormals[edge]!;
      if (!run.smooth) return own;
      const neighbour = edgeNormals[edge + (end ? 1 : -1)];
      if (!neighbour) return own;
      const nz = own[0] + neighbour[0],
        nr = own[1] + neighbour[1];
      const length = Math.hypot(nz, nr) || 1;
      return [nz / length, nr / length] as const;
    };
    for (let edge = 0; edge < edgeNormals.length; edge++) {
      const p0 = points[edge]!,
        p1 = points[edge + 1]!;
      const n0 = vertexNormal(edge, 0),
        n1 = vertexNormal(edge, 1);
      for (let j = 0; j < segments; j++) {
        const k = (j + 1) % segments;
        const vertex = (p: readonly [number, number], n: readonly [number, number], s: number) => ({
          p: [p[0], p[1] * cos[s]!, p[1] * sin[s]!] as const,
          n: [n[0], n[1] * cos[s]!, n[1] * sin[s]!] as const,
        });
        const quad = [vertex(p0, n0, j), vertex(p1, n1, j), vertex(p1, n1, k), vertex(p0, n0, k)];
        for (const triangle of [
          [0, 1, 2],
          [0, 2, 3],
        ]) {
          const i0 = triangle[0]!;
          let [i1, i2] = [triangle[1]!, triangle[2]!];
          a.fromArray(quad[i0]!.p);
          b.fromArray(quad[i1]!.p);
          c.fromArray(quad[i2]!.p);
          face.subVectors(b, a).cross(c.clone().sub(a));
          if (face.lengthSq() < 1e-14) continue;
          const intended = new Vector3()
            .fromArray(quad[i0]!.n)
            .add(new Vector3().fromArray(quad[i1]!.n))
            .add(new Vector3().fromArray(quad[i2]!.n));
          if (face.dot(intended) < 0) [i1, i2] = [i2, i1];
          for (const index of [i0, i1, i2]) {
            position.push(...quad[index]!.p);
            normal.push(...quad[index]!.n);
          }
        }
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  return geometry;
}

/** Non-indexed copy without uv and without zero-area triangles. */
function clean(input: BufferGeometry) {
  const source = input.index ? input.toNonIndexed() : input;
  const positions = source.getAttribute('position');
  const normals = source.getAttribute('normal');
  const xyz: number[] = [];
  const nxyz: number[] = [];
  const v = [new Vector3(), new Vector3(), new Vector3()] as const;
  for (let i = 0; i < positions.count; i += 3) {
    for (let j = 0; j < 3; j++) v[j]!.fromBufferAttribute(positions, i + j);
    const face = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
    if (face.lengthSq() < 1e-14) continue;
    face.normalize();
    for (let j = 0; j < 3; j++) {
      xyz.push(...v[j]!.toArray());
      const n = new Vector3().fromBufferAttribute(normals, i + j);
      nxyz.push(...(n.lengthSq() > 1e-12 ? n.normalize() : face).toArray());
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(xyz, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(nxyz, 3));
  if (source !== input) source.dispose();
  input.dispose();
  return geometry;
}

function boxGeometry(part: Extract<LayoutPart, { kind: 'box' }>) {
  const [z0, z1] = part.z;
  const depth = z1 - z0;
  const y = part.centerY ?? 0;
  if (!part.hole)
    return new BoxGeometry(depth, part.halfY * 2, part.halfX * 2).translate((z0 + z1) / 2, y, 0);
  const shape = new Shape();
  shape.moveTo(-part.halfX, -part.halfY);
  shape.lineTo(part.halfX, -part.halfY);
  shape.lineTo(part.halfX, part.halfY);
  shape.lineTo(-part.halfX, part.halfY);
  shape.closePath();
  const hole = new Path();
  if (part.hole.shape === 'circle') hole.absarc(0, 0, part.hole.radius, 0, TAU, true);
  else {
    hole.moveTo(-part.hole.halfX, -part.hole.halfY);
    hole.lineTo(-part.hole.halfX, part.hole.halfY);
    hole.lineTo(part.hole.halfX, part.hole.halfY);
    hole.lineTo(part.hole.halfX, -part.hole.halfY);
    hole.closePath();
  }
  shape.holes.push(hole);
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 })
    .translate(0, 0, z0)
    .rotateY(Math.PI / 2)
    .translate(0, y, 0);
}

function partGeometry(part: LayoutPart, segments: number) {
  if (part.kind === 'revolved') return revolveRuns(part.runs, segments);
  if (part.kind === 'torus')
    return new TorusGeometry(part.radius, part.tube, 16, segments)
      .rotateY(Math.PI / 2)
      .translate(part.z, 0, 0);
  return boxGeometry(part);
}

export function createAclAssembly(
  prescription: Readonly<LensPrescription> = ACL_DEFAULT_PRESCRIPTION,
): AclAssembly {
  const optics = prepareOptics(prescription);
  const layout = createCameraLayout(optics);
  const segments = optics.prescription.radialSegments;
  if (!Number.isInteger(segments) || segments < 32 || segments > 192)
    throw new RangeError('Invalid radial segment count');
  const breaks = { after: ACL_EXPLODE_MODULE_BREAKS, gap: ACL_EXPLODE_MODULE_GAP_MM };
  const whole = explodeOffsets(
    layout.parts,
    ACL_EXPLODE_ORDER,
    ACL_EXPLODE_GAP_MM,
    () => true,
    breaks,
  );
  const hidden = (part: LayoutPart) => ACL_HIDDEN_IN_OPTICS.includes(part.partId);
  const opticsOffsets = explodeOffsets(
    layout.parts,
    ACL_EXPLODE_ORDER,
    ACL_EXPLODE_GAP_MM,
    (part) => !hidden(part),
    breaks,
  );
  const scene = new Group();
  scene.name = 'generic-automotive-camera-lens';
  scene.rotation.z = ACL_AXIS_TILT_RAD;
  scene.scale.setScalar(0.001);
  scene.userData = {
    modelKind: 'illustrative-automotive-camera-lens',
    sourceUnits: 'mm',
    units: 'm',
    opticalAxis: '+x local (object side −x)',
    axisTiltRad: ACL_AXIS_TILT_RAD,
    paraxialOnly: true,
  };
  const parts: AclMeshPart[] = [];
  let disposed = false;
  for (const part of layout.parts) {
    const geometry = clean(partGeometry(part, segments));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const look = appearance(part, optics.prescription);
    const material = new MeshStandardMaterial({
      color: look.color,
      metalness: look.metalness,
      roughness: look.roughness,
      transparent: look.opacity !== undefined,
      opacity: look.opacity ?? 1,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = part.id;
    const explodeOffsetMm: [number, number, number] = [whole.get(part.group)!, 0, 0];
    const opticsExplodeOffsetMm: [number, number, number] | null = hidden(part)
      ? null
      : [opticsOffsets.get(part.group)!, 0, 0];
    mesh.userData = {
      id: part.id,
      partId: part.partId,
      group: part.group,
      material: look.material,
      explodeOffsetMm,
      opticsExplodeOffsetMm,
      schematic: true,
    };
    // Transparent optics render after the opaque mechanics they sit inside.
    mesh.renderOrder = look.opacity !== undefined ? 1 : 0;
    parts.push({
      id: part.id,
      partId: part.partId,
      group: part.group,
      explodeOffsetMm,
      opticsExplodeOffsetMm,
      mesh,
    });
    scene.add(mesh);
  }
  scene.updateMatrixWorld(true);
  return {
    scene,
    parts,
    optics,
    layout,
    update({ mode = 'whole', separation = 0 } = {}) {
      if (disposed) return;
      if (!Number.isFinite(separation) || separation < 0 || separation > 1)
        throw new RangeError('Separation must be in [0,1]');
      for (const part of parts) {
        const visible = mode === 'whole' || part.opticsExplodeOffsetMm !== null;
        const offset = mode === 'whole' ? part.explodeOffsetMm : part.opticsExplodeOffsetMm;
        part.mesh.visible = visible;
        part.mesh.position.set((offset?.[0] ?? 0) * separation, 0, 0);
      }
      scene.updateMatrixWorld(true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const part of parts) {
        part.mesh.geometry.dispose();
        part.mesh.material.dispose();
      }
      scene.clear();
    },
  };
}
