/**
 * Meridional cross-section for the SVG ray card, computed at build time from the same
 * optical model and mechanical layout as the 3D assembly. SVG user units are mm:
 * x = axial z, y = −height (up on screen is +height).
 */
import { axialExtent, type CameraLayout, type LayoutPart, type ProfilePoint } from './layout.ts';
import type { OpticalModel } from './optics.ts';
import type { AclPartId } from './params.ts';

export type SectionShape = { id: string; partId: AclPartId; d: string };
export type SectionRay = { field: number; kind: 'chief' | 'upper' | 'lower'; d: string };
export type SectionLabel = { partId: AclPartId; text: string; x: number; y: number };
export type SectionData = {
  viewBox: string;
  bounds: { x: number; y: number; width: number; height: number };
  axis: { x1: number; x2: number };
  imageX: number;
  optical: SectionShape[];
  mechanical: SectionShape[];
  rays: SectionRay[];
  labels: SectionLabel[];
  fieldStarts: { field: number; deg: number; x: number; y: number }[];
  /** Extra hit area spanning the stop opening so a click in the aperture selects it. */
  stopHit: { x: number; y: number; width: number; height: number };
};

const OPTICAL: readonly AclPartId[] = [
  'lens-1',
  'lens-2',
  'lens-3',
  'lens-4',
  'lens-5',
  'lens-6',
  'aperture-stop',
  'ir-cut-filter',
  'image-sensor',
];
const f = (value: number) => (Math.round(value * 100) / 100).toString();
const polygon = (points: readonly ProfilePoint[]) =>
  'M ' + points.map(([z, y]) => `${f(z)} ${f(-y)}`).join(' L ') + ' Z';
const rect = (x0: number, x1: number, y0: number, y1: number) =>
  polygon([
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]);

function shapes(part: LayoutPart): string[] {
  if (part.kind === 'torus')
    return [1, -1].map((sign) => {
      const cy = f(-sign * part.radius);
      const r = f(part.tube);
      return `M ${f(part.z - part.tube)} ${cy} a ${r} ${r} 0 1 0 ${f(2 * part.tube)} 0 a ${r} ${r} 0 1 0 ${f(-2 * part.tube)} 0 Z`;
    });
  if (part.kind === 'box') {
    const [z0, z1] = part.z;
    const c = part.centerY ?? 0;
    if (!part.hole) return [rect(z0, z1, c - part.halfY, c + part.halfY)];
    const inner = part.hole.shape === 'circle' ? part.hole.radius : part.hole.halfY;
    return [rect(z0, z1, c + inner, c + part.halfY), rect(z0, z1, c - part.halfY, c - inner)];
  }
  // Every other sample of smooth sag curves is ample at diagram scale.
  const upper = part.runs.flatMap((run, index) => {
    const points = run.smooth
      ? run.points.filter((_, i) => i % 2 === 0 || i === run.points.length - 1)
      : run.points;
    return index === 0 ? points : points.slice(1);
  });
  const touchesAxis = upper.some((point) => point[1] === 0);
  if (touchesAxis) {
    const lower = upper
      .slice()
      .reverse()
      .map(([z, r]) => [z, -r] as ProfilePoint);
    return [polygon([...upper, ...lower.slice(1, -1)])];
  }
  return [polygon(upper), polygon(upper.map(([z, r]) => [z, -r] as ProfilePoint))];
}

export function createSection(optics: OpticalModel, layout: CameraLayout): SectionData {
  const lead = Math.min(...optics.rays.map((ray) => ray.points[0]!.z));
  const x = lead - 2.4;
  const right = layout.dims.pcbBack! + 0.8;
  const halfHeight = layout.dims.holderHalf! + 0.6;
  const optical: SectionShape[] = [];
  const mechanical: SectionShape[] = [];
  for (const part of layout.parts) {
    const target = OPTICAL.includes(part.partId) ? optical : mechanical;
    for (const [index, d] of shapes(part).entries())
      target.push({ id: `${part.id}-${index}`, partId: part.partId, d });
  }
  const rays = optics.rays.map((ray) => ({
    field: ray.field,
    kind: ray.kind,
    d: 'M ' + ray.points.map((point) => `${f(point.z)} ${f(-point.y)}`).join(' L '),
  }));
  // Labels sit above each element; one that would crowd its left neighbour moves below.
  const labels: SectionLabel[] = [];
  optics.elements.forEach((element, index) => {
    const lens = layout.parts.find((part) => part.id === element.id)!;
    const [z0, z1] = axialExtent(lens);
    const x = (z0 + z1) / 2;
    const offset = optics.prescription.elements[index]!.outerRadius + 0.7;
    const previous = labels.at(-1);
    const crowded = previous !== undefined && previous.y < 0 && x - previous.x < 1.8;
    labels.push({
      partId: element.id as AclPartId,
      text: `L${index + 1}`,
      x,
      y: crowded ? offset + 0.75 : -offset,
    });
  });
  const fieldStarts = optics.prescription.fieldAnglesDeg.map((deg, field) => {
    const chief = optics.rays.find((ray) => ray.field === field && ray.kind === 'chief')!;
    return { field, deg, x: chief.points[0]!.z, y: -chief.points[0]!.y };
  });
  return {
    viewBox: `${f(x)} ${f(-halfHeight)} ${f(right - x)} ${f(2 * halfHeight)}`,
    bounds: { x, y: -halfHeight, width: right - x, height: 2 * halfHeight },
    axis: { x1: x + 0.2, x2: right - 0.2 },
    imageX: optics.imageZ,
    optical,
    mechanical,
    rays,
    labels,
    fieldStarts,
    stopHit: {
      x: optics.stopZ - 0.35,
      y: -layout.dims.rearBore!,
      width: 0.7,
      height: 2 * layout.dims.rearBore!,
    },
  };
}
