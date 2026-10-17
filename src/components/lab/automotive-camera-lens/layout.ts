/**
 * Mechanical layout derived from the paraxial prescription. Pure data, no Three.js:
 * the SVG cross-section, the runtime Three assembly and the GLB generator share it.
 * Units are mm. A profile point is [z, r]: z on the optical axis (object side first),
 * r radial distance. Rotational parts are closed clockwise profiles in the (z, r)
 * half plane; prismatic parts are axis-aligned boxes.
 */
import { sag, type OpticalModel } from './optics.ts';
import type { AclPartId } from './params.ts';

export type ProfilePoint = [z: number, r: number];
/** A run of points shaded smoothly; consecutive runs meet at hard edges. */
export type ProfileRun = { points: ProfilePoint[]; smooth: boolean };
export type RevolvedPart = {
  kind: 'revolved';
  id: string;
  partId: AclPartId;
  group: string;
  runs: ProfileRun[];
};
export type TorusPart = {
  kind: 'torus';
  id: string;
  partId: AclPartId;
  group: string;
  z: number;
  radius: number;
  tube: number;
};
/** Box or square frame centred on the axis: half sizes in section height (y) and depth (x). */
export type BoxPart = {
  kind: 'box';
  id: string;
  partId: AclPartId;
  group: string;
  z: [number, number];
  halfY: number;
  halfX: number;
  centerY?: number;
  /** Optional centred opening: a square frame or a plate with a round hole. */
  hole?: { shape: 'square'; halfY: number; halfX: number } | { shape: 'circle'; radius: number };
};
export type LayoutPart = RevolvedPart | TorusPart | BoxPart;
export type CameraLayout = {
  parts: LayoutPart[];
  dims: Record<string, number>;
};

const CURVE_SAMPLES = 24;
function curve(
  shape: Parameters<typeof sag>[0],
  vertexZ: number,
  from: number,
  to: number,
): ProfilePoint[] {
  return Array.from({ length: CURVE_SAMPLES + 1 }, (_, index) => {
    const r = from + ((to - from) * index) / CURVE_SAMPLES;
    return [vertexZ + sag(shape, r), r] as ProfilePoint;
  });
}
const straight = (...points: ProfilePoint[]): ProfileRun => ({ points, smooth: false });
/** Clockwise rectangular annulus profile: front face, outer wall, back face, bore. */
function annulus(z0: number, z1: number, inner: number, outer: number): ProfileRun[] {
  return [
    straight([z0, inner], [z0, outer]),
    straight([z0, outer], [z1, outer]),
    straight([z1, outer], [z1, inner]),
    straight([z1, inner], [z0, inner]),
  ];
}
function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}

export function createCameraLayout(model: OpticalModel): CameraLayout {
  const elements = model.prescription.elements;
  const summary = model.elements;
  const parts: LayoutPart[] = [];
  const flange = elements.map((element, index) => ({
    front: summary[index]!.zFront + sag(element.front, element.clearFront),
    back: summary[index]!.zBack + sag(element.back, element.clearBack),
  }));
  elements.forEach((element, index) => {
    const zf = summary[index]!.zFront;
    const zb = summary[index]!.zBack;
    const { front, back } = flange[index]!;
    ensure(back - front > 0.5, `Edge thickness too small: ${element.id}`);
    parts.push({
      kind: 'revolved',
      id: element.id,
      partId: element.id as AclPartId,
      group: element.id,
      runs: [
        { points: curve(element.front, zf, 0, element.clearFront), smooth: true },
        straight([front, element.clearFront], [front, element.outerRadius]),
        straight([front, element.outerRadius], [back, element.outerRadius]),
        straight([back, element.outerRadius], [back, element.clearBack]),
        { points: curve(element.back, zb, element.clearBack, 0), smooth: true },
      ],
    });
  });
  const first = elements[0]!;
  const last = elements.at(-1)!;
  const rearBore = Math.max(...elements.slice(1).map((element) => element.outerRadius));
  const oRingTube = 0.38;
  const oRingRadius = first.outerRadius + 0.02 + oRingTube;
  const frontBore = oRingRadius + oRingTube + 0.02;
  const ringThickness = 1.2;
  const ringBack = flange[0]!.front;
  const ringFront = ringBack - ringThickness;
  const barrelFront = ringFront - 0.15;
  const shoulder = flange[0]!.back;
  const hoodOuter = frontBore + 1;
  const threadCrest = rearBore + 1.7;
  const threadRoot = threadCrest - 0.15;
  const lipFront = flange.at(-1)!.back;
  const lipBack = lipFront + 0.6;
  const lipInner = last.clearBack + 0.2;
  // Stop sheet and spacers. Each spacer fills the flange-to-flange gap between neighbours.
  const stopHalf = model.prescription.stop.sheetThicknessMm / 2;
  const stopFront = model.stopZ - stopHalf;
  const stopBack = model.stopZ + stopHalf;
  parts.push({
    kind: 'revolved',
    id: 'aperture-stop',
    partId: 'aperture-stop',
    group: 'aperture-stop',
    runs: annulus(stopFront, stopBack, model.stopRadius, rearBore),
  });
  const stopAfter = elements.findIndex(
    (element) => element.id === model.prescription.stop.afterElement,
  );
  type Interval = { z0: number; z1: number; inner: number };
  const gaps: Interval[] = [];
  for (let index = 0; index < elements.length - 1; index++) {
    const previous = elements[index]!;
    const next = elements[index + 1]!;
    if (index === stopAfter) {
      gaps.push({
        z0: flange[index]!.back,
        z1: stopFront,
        inner: Math.max(previous.clearBack, model.stopRadius) + 0.2,
      });
      gaps.push({
        z0: stopBack,
        z1: flange[index + 1]!.front,
        inner: Math.max(next.clearFront, model.stopRadius) + 0.2,
      });
    } else
      gaps.push({
        z0: flange[index]!.back,
        z1: flange[index + 1]!.front,
        inner: Math.max(previous.clearBack, next.clearFront) + 0.2,
      });
  }
  gaps.forEach((gap, index) => {
    ensure(gap.z1 - gap.z0 > 0.1, `Spacer ${index + 1} has no axial room`);
    ensure(gap.inner < rearBore - 0.2, `Spacer ${index + 1} has no radial wall`);
    parts.push({
      kind: 'revolved',
      id: `spacer-${index + 1}`,
      partId: 'spacers',
      group: `spacer-${index + 1}`,
      runs: annulus(gap.z0, gap.z1, gap.inner, rearBore),
    });
  });
  // Barrel: front hood around L1, threaded body, rear lip that seats L6.
  const pitch = 0.5;
  const threadStart = shoulder + 0.4;
  const teeth = Math.floor((lipBack - 0.4 - threadStart) / pitch);
  const thread: ProfileRun[] = [];
  for (let tooth = 0; tooth < teeth; tooth++) {
    const z = threadStart + tooth * pitch;
    thread.push(straight([z, threadCrest], [z + pitch / 2, threadRoot]));
    thread.push(straight([z + pitch / 2, threadRoot], [z + pitch, threadCrest]));
  }
  const threadEnd = threadStart + teeth * pitch;
  parts.push({
    kind: 'revolved',
    id: 'lens-barrel',
    partId: 'lens-barrel',
    group: 'lens-barrel',
    runs: [
      straight([barrelFront, frontBore], [barrelFront, hoodOuter]),
      straight([barrelFront, hoodOuter], [shoulder, hoodOuter]),
      straight([shoulder, hoodOuter], [shoulder, threadCrest]),
      straight([shoulder, threadCrest], [threadStart, threadCrest]),
      ...thread,
      straight([threadEnd, threadCrest], [lipBack, threadCrest]),
      straight([lipBack, threadCrest], [lipBack, lipInner]),
      straight([lipBack, lipInner], [lipFront, lipInner]),
      straight([lipFront, lipInner], [lipFront, rearBore]),
      straight([lipFront, rearBore], [shoulder, rearBore]),
      straight([shoulder, rearBore], [shoulder, frontBore]),
      straight([shoulder, frontBore], [barrelFront, frontBore]),
    ],
  });
  parts.push({
    kind: 'revolved',
    id: 'retaining-ring',
    partId: 'retaining-ring',
    group: 'retaining-ring',
    runs: annulus(ringFront, ringBack, first.clearFront + 0.2, frontBore - 0.02),
  });
  parts.push({
    kind: 'torus',
    id: 'o-ring',
    partId: 'o-ring',
    group: 'o-ring',
    z: (flange[0]!.front + flange[0]!.back) / 2,
    radius: oRingRadius,
    tube: oRingTube,
  });
  // Holder: threaded neck, filter plate and square skirt bonded to the PCB.
  const [filterFront, filterBack] = model.metrics.filterZ;
  const neckOuter = threadCrest + 1.6;
  const neckFront = lipBack - 8.5;
  const plateFront = lipBack + 1.2;
  ensure(filterFront - plateFront > 0.5, 'Holder plate has no room in front of the filter');
  ensure(neckFront > shoulder + 1, 'Holder neck reaches the barrel hood');
  const half = 10;
  const skirtInner = 8.5;
  const imageZ = model.imageZ;
  const aaFront = imageZ + 0.6;
  const pcbFront = imageZ + 0.95;
  const pcbBack = pcbFront + 1.6;
  ensure(aaFront - filterBack > 2, 'Sensor cavity is too shallow');
  parts.push({
    kind: 'revolved',
    id: 'holder-neck',
    partId: 'lens-holder',
    group: 'lens-holder',
    runs: annulus(neckFront, plateFront, threadCrest, neckOuter),
  });
  const filterHalf = model.prescription.filter.halfWidth;
  parts.push({
    kind: 'box',
    id: 'holder-plate',
    partId: 'lens-holder',
    group: 'lens-holder',
    z: [plateFront, filterFront],
    halfY: half,
    halfX: half,
    hole: { shape: 'circle', radius: filterHalf - 0.4 },
  });
  parts.push({
    kind: 'box',
    id: 'holder-skirt',
    partId: 'lens-holder',
    group: 'lens-holder',
    z: [filterFront, aaFront],
    halfY: half,
    halfX: half,
    hole: { shape: 'square', halfY: skirtInner, halfX: skirtInner },
  });
  parts.push({
    kind: 'box',
    id: 'ir-cut-filter',
    partId: 'ir-cut-filter',
    group: 'ir-cut-filter',
    z: [filterFront, filterBack],
    halfY: filterHalf,
    halfX: filterHalf,
  });
  parts.push({
    kind: 'box',
    id: 'aa-adhesive-bead',
    partId: 'aa-adhesive',
    group: 'aa-adhesive',
    z: [aaFront, pcbFront],
    halfY: half,
    halfX: half,
    hole: { shape: 'square', halfY: half - 1.2, halfX: half - 1.2 },
  });
  // The active die surface lies on the paraxial image plane; cover glass is omitted.
  parts.push({
    kind: 'box',
    id: 'sensor-die',
    partId: 'image-sensor',
    group: 'image-sensor',
    z: [imageZ, imageZ + 0.05],
    halfY: 2.5,
    halfX: 3.2,
  });
  parts.push({
    kind: 'box',
    id: 'sensor-package',
    partId: 'image-sensor',
    group: 'image-sensor',
    z: [imageZ + 0.05, pcbFront],
    halfY: 3.8,
    halfX: 4.6,
  });
  parts.push({
    kind: 'box',
    id: 'pcb-board',
    partId: 'pcb',
    group: 'pcb',
    z: [pcbFront, pcbBack],
    halfY: 12,
    halfX: 12,
  });
  parts.push({
    kind: 'box',
    id: 'pcb-connector',
    partId: 'pcb',
    group: 'pcb',
    z: [pcbBack, pcbBack + 2.4],
    halfY: 1.6,
    halfX: 4.5,
    centerY: -7.5,
  });
  parts.push({
    kind: 'box',
    id: 'pcb-regulator',
    partId: 'pcb',
    group: 'pcb',
    z: [pcbBack, pcbBack + 0.9],
    halfY: 1.5,
    halfX: 1.5,
    centerY: 4.5,
  });
  return {
    parts,
    dims: {
      barrelFront,
      shoulder,
      frontBore,
      rearBore,
      hoodOuter,
      threadCrest,
      lipFront,
      lipBack,
      neckFront,
      neckOuter,
      plateFront,
      filterFront,
      filterBack,
      imageZ,
      aaFront,
      pcbFront,
      pcbBack,
      holderHalf: half,
      skirtInner,
    },
  };
}

/** Axial extent of a layout part (mm). */
export function axialExtent(part: LayoutPart): [number, number] {
  if (part.kind === 'box') return part.z;
  if (part.kind === 'torus') return [part.z - part.tube, part.z + part.tube];
  const z = part.runs.flatMap((run) => run.points.map((point) => point[0]));
  return [Math.min(...z), Math.max(...z)];
}

/**
 * Exploded axial offsets per explosion group: groups are laid out in the given order
 * with a constant display gap and the exploded span is centred on the assembled span.
 */
export function explodeOffsets(
  parts: readonly LayoutPart[],
  order: readonly string[],
  gap: number,
  visible: (part: LayoutPart) => boolean = () => true,
  breaks: { after: readonly string[]; gap: number } = { after: [], gap },
) {
  const extents = new Map<string, [number, number]>();
  for (const part of parts) {
    if (!visible(part)) continue;
    const [z0, z1] = axialExtent(part);
    const current = extents.get(part.group);
    extents.set(
      part.group,
      current ? [Math.min(current[0], z0), Math.max(current[1], z1)] : [z0, z1],
    );
  }
  const groups = order.filter((group) => extents.has(group));
  ensure(groups.length === extents.size, 'Every visible explosion group needs an order');
  const assembled = [...extents.values()];
  const assembledCenter =
    (Math.min(...assembled.map((value) => value[0])) +
      Math.max(...assembled.map((value) => value[1]))) /
    2;
  const placed = new Map<string, number>();
  let cursor = 0;
  for (const group of groups) {
    const [z0, z1] = extents.get(group)!;
    placed.set(group, cursor - z0);
    cursor += z1 - z0 + (breaks.after.includes(group) ? breaks.gap : gap);
  }
  const last = groups.at(-1)!;
  const span = cursor - (breaks.after.includes(last) ? breaks.gap : gap);
  const shift = assembledCenter - span / 2;
  return new Map([...placed].map(([group, offset]) => [group, offset + shift]));
}
