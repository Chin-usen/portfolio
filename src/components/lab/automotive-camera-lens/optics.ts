/**
 * Paraxial (first-order) optics for the illustrative six-element automotive lens.
 * Units: mm and radians. z runs along the optical axis from the object side;
 * the first lens vertex is z = 0. Ray heights are measured from the axis.
 *
 * Refraction at a surface: n'u' = nu − yφ with φ = (n' − n) c, c = 1 / R.
 * Transfer: y₊ = y + u' t. Effective focal length f' = −y₁ / u'ₖ for an axial ray
 * entering parallel to the axis. Conic and polynomial terms only shape the drawn
 * and modelled surfaces; the paraxial trace uses the vertex curvature alone.
 */
export type LensMaterial = 'glass' | 'plastic';
export type SurfaceShape = { radius: number; conic: number; a4: number };
export type LensElement = {
  id: string;
  material: LensMaterial;
  nd: number;
  front: SurfaceShape;
  back: SurfaceShape;
  thickness: number;
  gapAfter: number;
  clearFront: number;
  clearBack: number;
  outerRadius: number;
};
export type LensPrescription = {
  fNumber: number;
  fieldAnglesDeg: number[];
  elements: LensElement[];
  stop: { afterElement: string; distanceMm: number; sheetThicknessMm: number };
  filter: { nd: number; thickness: number; halfWidth: number };
  radialSegments: number;
};
export type TraceSurface = {
  /** Owning item; null for no owner. */
  owner: string;
  role: 'front' | 'back' | 'stop' | 'filter-front' | 'filter-back';
  z: number;
  /** Vertex curvature (1/mm); 0 for a plane. */
  curvature: number;
  shape: SurfaceShape | null;
  /** Refractive index after the surface. */
  indexAfter: number;
  clearRadius: number;
};
export type RayPoint = { z: number; y: number };
export type RayPath = {
  field: number;
  fieldDeg: number;
  kind: 'chief' | 'upper' | 'lower';
  points: RayPoint[];
};
export type ElementSummary = {
  id: string;
  material: LensMaterial;
  aspheric: boolean;
  nd: number;
  focalLengthMm: number;
  zFront: number;
  zBack: number;
};
export type OpticalModel = {
  prescription: LensPrescription;
  surfaces: TraceSurface[];
  stopIndex: number;
  stopZ: number;
  stopRadius: number;
  imageZ: number;
  metrics: {
    effectiveFocalLengthMm: number;
    backFocalDistanceMm: number;
    totalTrackMm: number;
    entrancePupilDiameterMm: number;
    fNumber: number;
    halfFieldDeg: number[];
    imageHeightsMm: number[];
    filterZ: [number, number];
  };
  elements: ElementSummary[];
  rays: RayPath[];
};

function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}

/** Even-asphere sag: z(r) = c r² / (1 + √(1 − (1 + k) c² r²)) + A₄ r⁴. */
export function sag(shape: SurfaceShape | null, r: number) {
  if (!shape || !Number.isFinite(shape.radius) || shape.radius === 0) return 0;
  const c = 1 / shape.radius;
  const root = 1 - (1 + shape.conic) * c * c * r * r;
  ensure(root > 0, 'Surface sag is undefined inside its clear radius');
  return (c * r * r) / (1 + Math.sqrt(root)) + shape.a4 * r ** 4;
}

export function validatePrescription(p: LensPrescription) {
  ensure(p.elements.length === 6, 'The teaching lens has exactly six elements');
  ensure(p.fNumber >= 1.2 && p.fNumber <= 8, 'F-number out of range');
  ensure(
    p.fieldAnglesDeg.length === 3 &&
      p.fieldAnglesDeg[0] === 0 &&
      p.fieldAnglesDeg.every((value, index, all) => index === 0 || value > all[index - 1]!) &&
      p.fieldAnglesDeg[2]! < 60,
    'Three increasing field angles starting on axis are required',
  );
  ensure(p.elements[0]!.material === 'glass', 'The front element must be glass');
  for (const element of p.elements) {
    ensure(element.nd > 1.3 && element.nd < 2.1, `Index out of range: ${element.id}`);
    ensure(element.thickness > 0 && element.gapAfter > 0, `Invalid spacing: ${element.id}`);
    ensure(
      element.clearFront < element.outerRadius && element.clearBack < element.outerRadius,
      `Clear aperture exceeds element: ${element.id}`,
    );
    ensure(
      element.material === 'plastic' ||
        [element.front, element.back].every((shape) => shape.conic === 0 && shape.a4 === 0),
      `Glass elements remain spherical in this teaching set: ${element.id}`,
    );
  }
  ensure(
    p.elements.some((element) => element.id === p.stop.afterElement),
    'Unknown stop position',
  );
  return p;
}

type Trace = { y: number; u: number; heights: number[] };
function trace(surfaces: readonly TraceSurface[], y: number, u: number, count = surfaces.length) {
  let n = 1;
  const heights: number[] = [];
  for (let index = 0; index < count; index++) {
    const surface = surfaces[index]!;
    heights.push(y);
    const power = (surface.indexAfter - n) * surface.curvature;
    u = (n * u - y * power) / surface.indexAfter;
    n = surface.indexAfter;
    const next = surfaces[index + 1];
    if (next && index + 1 < count) y += u * (next.z - surface.z);
  }
  return { y, u, heights } satisfies Trace;
}

export function createOpticalModel(input: LensPrescription): OpticalModel {
  const prescription = validatePrescription(structuredClone(input));
  const surfaces: TraceSurface[] = [];
  const elements: ElementSummary[] = [];
  let z = 0;
  let stopIndex = -1;
  let stopZ = 0;
  for (const element of prescription.elements) {
    const zFront = z;
    surfaces.push({
      owner: element.id,
      role: 'front',
      z,
      curvature: 1 / element.front.radius,
      shape: element.front,
      indexAfter: element.nd,
      clearRadius: element.clearFront,
    });
    z += element.thickness;
    surfaces.push({
      owner: element.id,
      role: 'back',
      z,
      curvature: 1 / element.back.radius,
      shape: element.back,
      indexAfter: 1,
      clearRadius: element.clearBack,
    });
    const c1 = 1 / element.front.radius;
    const c2 = 1 / element.back.radius;
    const phi1 = (element.nd - 1) * c1;
    const phi2 = (1 - element.nd) * c2;
    const power = phi1 + phi2 - (element.thickness / element.nd) * phi1 * phi2;
    elements.push({
      id: element.id,
      material: element.material,
      aspheric: [element.front, element.back].some((shape) => shape.conic !== 0 || shape.a4 !== 0),
      nd: element.nd,
      focalLengthMm: 1 / power,
      zFront,
      zBack: z,
    });
    if (element.id === prescription.stop.afterElement) {
      ensure(
        prescription.stop.distanceMm < element.gapAfter,
        'Stop must lie inside the following air gap',
      );
      stopZ = z + prescription.stop.distanceMm;
      stopIndex = surfaces.length;
      surfaces.push({
        owner: 'aperture-stop',
        role: 'stop',
        z: stopZ,
        curvature: 0,
        shape: null,
        indexAfter: 1,
        clearRadius: 0,
      });
    }
    z += element.gapAfter;
  }
  const filterFront = z;
  surfaces.push({
    owner: 'ir-cut-filter',
    role: 'filter-front',
    z,
    curvature: 0,
    shape: null,
    indexAfter: prescription.filter.nd,
    clearRadius: prescription.filter.halfWidth,
  });
  z += prescription.filter.thickness;
  surfaces.push({
    owner: 'ir-cut-filter',
    role: 'filter-back',
    z,
    curvature: 0,
    shape: null,
    indexAfter: 1,
    clearRadius: prescription.filter.halfWidth,
  });
  const axial = trace(surfaces, 1, 0);
  ensure(axial.u < 0, 'The lens must form a real image');
  const effectiveFocalLengthMm = -1 / axial.u;
  const backFocalDistanceMm = -axial.y / axial.u;
  ensure(backFocalDistanceMm > 0.5, 'Image plane must lie behind the filter');
  const imageZ = z + backFocalDistanceMm;
  // Stop height is linear in entrance height y and angle u: y_s = A y + B u.
  const A = trace(surfaces, 1, 0, stopIndex + 1).heights[stopIndex]!;
  const B = trace(surfaces, 0, 1, stopIndex + 1).heights[stopIndex]!;
  ensure(Math.abs(A) > 1e-9, 'Stop is conjugate to infinity');
  const entrancePupilDiameterMm = effectiveFocalLengthMm / prescription.fNumber;
  const stopRadius = Math.abs((A * entrancePupilDiameterMm) / 2);
  surfaces[stopIndex]!.clearRadius = stopRadius;
  const rays: RayPath[] = [];
  prescription.fieldAnglesDeg.forEach((fieldDeg, field) => {
    const u0 = Math.tan((fieldDeg * Math.PI) / 180);
    for (const [kind, sign] of [
      ['upper', 1],
      ['chief', 0],
      ['lower', -1],
    ] as const) {
      const y0 = (sign * stopRadius - B * u0) / A;
      const path = trace(surfaces, y0, u0);
      const points = surfaces.map((surface, index) => {
        const y = path.heights[index]!;
        return { z: surface.z + sag(surface.shape, Math.abs(y)), y };
      });
      const last = surfaces.at(-1)!;
      const yLast = path.heights.at(-1)!;
      points.push({ z: imageZ, y: yLast + path.u * (imageZ - last.z) });
      // Entry segment: start a fixed distance before the first lens vertex.
      const lead = 4;
      points.unshift({ z: -lead, y: y0 - u0 * lead });
      rays.push({ field, fieldDeg, kind, points });
    }
  });
  return {
    prescription,
    surfaces,
    stopIndex,
    stopZ,
    stopRadius,
    imageZ,
    metrics: {
      effectiveFocalLengthMm,
      backFocalDistanceMm,
      totalTrackMm: imageZ,
      entrancePupilDiameterMm,
      fNumber: prescription.fNumber,
      halfFieldDeg: [...prescription.fieldAnglesDeg],
      imageHeightsMm: prescription.fieldAnglesDeg.map(
        (deg) => effectiveFocalLengthMm * Math.tan((deg * Math.PI) / 180),
      ),
      filterZ: [filterFront, z],
    },
    elements,
    rays,
  };
}
