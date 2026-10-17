import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import params from '../../src/components/lab/automotive-camera-lens/params.json';
import {
  createOpticalModel,
  sag,
  type LensPrescription,
} from '../../src/components/lab/automotive-camera-lens/optics';
import {
  axialExtent,
  createCameraLayout,
  explodeOffsets,
} from '../../src/components/lab/automotive-camera-lens/layout';
import {
  ACL_EXPLODE_GAP_MM,
  ACL_EXPLODE_ORDER,
  ACL_HIDDEN_IN_OPTICS,
  ACL_PART_IDS,
  ACL_LENS_IDS,
} from '../../src/components/lab/automotive-camera-lens/params';
import { createAclAssembly } from '../../src/components/lab/automotive-camera-lens/geometry';
import { createSection } from '../../src/components/lab/automotive-camera-lens/section';

const prescription = params as LensPrescription;
const optics = createOpticalModel(prescription);
const layout = createCameraLayout(optics);

/** Independent reduced-angle ABCD system matrix: state (y, n u). */
function systemMatrix(p: LensPrescription) {
  let m = [
    [1, 0],
    [0, 1],
  ];
  const multiply = (a: number[][], b: number[][]) =>
    a.map((row) => b[0]!.map((_, j) => row[0]! * b[0]![j]! + row[1]! * b[1]![j]!));
  let n = 1;
  const surfaces: { c: number; nAfter: number; t: number }[] = [];
  p.elements.forEach((element) => {
    surfaces.push({ c: 1 / element.front.radius, nAfter: element.nd, t: element.thickness });
    surfaces.push({ c: 1 / element.back.radius, nAfter: 1, t: element.gapAfter });
  });
  surfaces.push({ c: 0, nAfter: p.filter.nd, t: p.filter.thickness });
  surfaces.push({ c: 0, nAfter: 1, t: 0 });
  for (const surface of surfaces) {
    m = multiply(
      [
        [1, 0],
        [-(surface.nAfter - n) * surface.c, 1],
      ],
      m,
    );
    n = surface.nAfter;
    m = multiply(
      [
        [1, surface.t / n],
        [0, 1],
      ],
      m,
    );
  }
  return m;
}

describe('illustrative automotive lens paraxial optics', () => {
  it('matches an independent ABCD system matrix for focal length and back focus', () => {
    const m = systemMatrix(prescription);
    const efl = -1 / m[1]![0]!;
    const bfd = -m[0]![0]! / m[1]![0]!;
    expect(optics.metrics.effectiveFocalLengthMm).toBeCloseTo(efl, 10);
    expect(optics.metrics.backFocalDistanceMm).toBeCloseTo(bfd, 10);
    expect(optics.metrics.effectiveFocalLengthMm).toBeCloseTo(5.832, 3);
    expect(optics.metrics.fNumber).toBe(2);
    expect(optics.metrics.entrancePupilDiameterMm).toBeCloseTo(efl / 2, 10);
  });
  it('images every field bundle to a point at y′ = f′ tan θ', () => {
    for (const [field, deg] of prescription.fieldAnglesDeg.entries()) {
      const expected = optics.metrics.effectiveFocalLengthMm * Math.tan((deg * Math.PI) / 180);
      const bundle = optics.rays.filter((ray) => ray.field === field);
      expect(bundle).toHaveLength(3);
      for (const ray of bundle) expect(ray.points.at(-1)!.y).toBeCloseTo(expected, 9);
      expect(optics.metrics.imageHeightsMm[field]).toBeCloseTo(expected, 12);
    }
  });
  it('passes chief rays through the stop centre and marginal rays through its edge', () => {
    const at = optics.stopIndex + 1; // ray points include the entry lead point
    for (const ray of optics.rays) {
      const y = ray.points[at]!.y;
      if (ray.kind === 'chief') expect(y).toBeCloseTo(0, 9);
      else expect(Math.abs(y)).toBeCloseTo(optics.stopRadius, 9);
    }
  });
  it('keeps all traced rays inside each surface clear aperture', () => {
    optics.surfaces.forEach((surface, index) => {
      if (surface.role === 'stop') return;
      for (const ray of optics.rays)
        expect(Math.abs(ray.points[index + 1]!.y), `${surface.owner} ${surface.role}`).toBeLessThan(
          surface.clearRadius,
        );
    });
  });
  it('describes a retrofocus mix: glass front, three glass spheres and three plastic aspheres', () => {
    expect(optics.elements.map((element) => element.id)).toEqual([...ACL_LENS_IDS]);
    expect(optics.elements[0]!.material).toBe('glass');
    expect(optics.elements.filter((e) => e.material === 'glass' && !e.aspheric)).toHaveLength(3);
    expect(optics.elements.filter((e) => e.material === 'plastic' && e.aspheric)).toHaveLength(3);
    expect(optics.elements.slice(0, 2).every((element) => element.focalLengthMm < 0)).toBe(true);
    expect(optics.metrics.backFocalDistanceMm + 0.7 + 2.4).toBeGreaterThan(
      optics.metrics.effectiveFocalLengthMm,
    );
  });
  it('rejects a plastic front element and aspheric glass', () => {
    const plasticFront = structuredClone(prescription);
    plasticFront.elements[0]!.material = 'plastic';
    expect(() => createOpticalModel(plasticFront)).toThrow(RangeError);
    const asphericGlass = structuredClone(prescription);
    asphericGlass.elements[2]!.front.conic = -1;
    expect(() => createOpticalModel(asphericGlass)).toThrow(RangeError);
  });
  it('uses the even-asphere sag with the vertex curvature at the axis', () => {
    const shape = { radius: 7, conic: -1, a4: -0.001 };
    expect(sag(shape, 0)).toBe(0);
    expect(sag(shape, 2)).toBeCloseTo(4 / 14 - 0.016, 12);
    expect(sag({ radius: 10, conic: 0, a4: 0 }, 6)).toBeCloseTo(10 - 8, 12);
  });
});

describe('derived mechanical layout', () => {
  const lenses = prescription.elements;
  it('never lets neighbouring optical surfaces cross inside their common aperture', () => {
    for (let index = 0; index < lenses.length - 1; index++) {
      const a = lenses[index]!,
        b = lenses[index + 1]!;
      const aBack = optics.elements[index]!.zBack,
        bFront = optics.elements[index + 1]!.zFront;
      const limit = Math.min(a.clearBack, b.clearFront);
      for (let step = 0; step <= 40; step++) {
        const r = (limit * step) / 40;
        expect(
          bFront + sag(b.front, r) - (aBack + sag(a.back, r)),
          `${a.id}/${b.id}`,
        ).toBeGreaterThan(0.05);
      }
    }
  });
  it('fills each flange gap with a spacer and seats the stop between L3 and L4', () => {
    const spacers = layout.parts.filter((part) => part.partId === 'spacers');
    expect(spacers).toHaveLength(6);
    for (const spacer of spacers) {
      const [z0, z1] = axialExtent(spacer);
      expect(z1 - z0).toBeGreaterThan(0.1);
    }
    expect(optics.stopZ).toBeGreaterThan(optics.elements[2]!.zBack);
    expect(optics.stopZ).toBeLessThan(optics.elements[3]!.zFront);
  });
  it('explodes groups along the axis in order without overlap', () => {
    const offsets = explodeOffsets(layout.parts, ACL_EXPLODE_ORDER, ACL_EXPLODE_GAP_MM);
    const spans = ACL_EXPLODE_ORDER.map((group) => {
      const members = layout.parts.filter((part) => part.group === group).map(axialExtent);
      const offset = offsets.get(group)!;
      return [
        Math.min(...members.map((e) => e[0])) + offset,
        Math.max(...members.map((e) => e[1])) + offset,
      ];
    });
    for (let index = 1; index < spans.length; index++)
      expect(spans[index]![0]! - spans[index - 1]![1]!).toBeCloseTo(ACL_EXPLODE_GAP_MM, 9);
  });
  it('places the sensor die on the paraxial image plane', () => {
    const die = layout.parts.find((part) => part.id === 'sensor-die')!;
    expect(axialExtent(die)[0]).toBeCloseTo(optics.imageZ, 12);
  });
});

describe('Three.js camera lens assembly', () => {
  it('owns all sixteen semantic parts as independently named, closed, outward geometry', () => {
    const assembly = createAclAssembly();
    try {
      expect([...new Set(assembly.parts.map((p) => p.partId))].sort()).toEqual(
        [...ACL_PART_IDS].sort(),
      );
      expect(new Set(assembly.parts.map((p) => p.mesh.name)).size).toBe(assembly.parts.length);
      for (const { mesh, id } of assembly.parts) {
        const p = mesh.geometry.getAttribute('position');
        const n = mesh.geometry.getAttribute('normal');
        expect(Array.from(p.array).every(Number.isFinite), id).toBe(true);
        let volume = 0;
        for (let i = 0; i < p.count; i += 3) {
          const [a, b, c] = [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(p, i + k)) as [
            Vector3,
            Vector3,
            Vector3,
          ];
          expect(b.clone().sub(a).cross(c.clone().sub(a)).length(), id).toBeGreaterThan(1e-8);
          volume += a.dot(b.clone().cross(c)) / 6;
          expect(new Vector3().fromBufferAttribute(n, i).length(), id).toBeCloseTo(1, 4);
        }
        expect(volume, id).toBeGreaterThan(0);
      }
    } finally {
      assembly.dispose();
    }
  });
  it('hides mechanics in the optical-train view and spreads only along the axis', () => {
    const assembly = createAclAssembly();
    try {
      assembly.update({ mode: 'optics', separation: 1 });
      const visible = new Set(assembly.parts.filter((p) => p.mesh.visible).map((p) => p.partId));
      expect([...visible].sort()).toEqual(
        ACL_PART_IDS.filter((id) => !ACL_HIDDEN_IN_OPTICS.includes(id)).sort(),
      );
      assembly.update({ mode: 'whole', separation: 0.5 });
      for (const part of assembly.parts) {
        expect(part.mesh.visible).toBe(true);
        expect(part.mesh.position.y).toBe(0);
        expect(part.mesh.position.z).toBe(0);
        expect(part.mesh.position.x).toBeCloseTo(part.explodeOffsetMm[0] * 0.5, 12);
      }
      expect(() => assembly.update({ separation: 1.5 })).toThrow(RangeError);
    } finally {
      assembly.dispose();
    }
  });
});

describe('SVG ray section', () => {
  const section = createSection(optics, layout);
  it('draws nine selectable optical items, three bundles and every mechanical part', () => {
    expect(new Set(section.optical.map((shape) => shape.partId)).size).toBe(9);
    expect(section.rays).toHaveLength(9);
    const mechanical = new Set(section.mechanical.map((shape) => shape.partId));
    for (const id of ACL_PART_IDS)
      expect(mechanical.has(id) || section.optical.some((s) => s.partId === id), id).toBe(true);
    expect(section.labels.map((label) => label.text)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
    for (const ray of section.rays) expect(ray.d).toMatch(/^M -?\d/);
  });
  it('keeps element labels apart', () => {
    const above = section.labels.filter((label) => label.y < 0);
    for (let index = 1; index < above.length; index++)
      expect(above[index]!.x - above[index - 1]!.x).toBeGreaterThanOrEqual(1.8);
  });
});
