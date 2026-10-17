import { describe, expect, it } from 'vitest';
import {
  createHarmonicModel,
  flexToothPosition,
  kinematics,
  radialDeformationMm,
  rpmToRadiansPerSecond,
  TAU,
  validateParameters,
} from '../../src/components/lab/harmonic-drive/math';
import {
  HARMONIC_DEFAULT_PARAMETERS,
  HARMONIC_PART_IDS,
} from '../../src/components/lab/harmonic-drive/params';
import { createHarmonicAssembly } from '../../src/components/lab/harmonic-drive/geometry';
const defaults = HARMONIC_DEFAULT_PARAMETERS;
describe('Harmonic fixed-circular-spline kinematics and schematic geometry', () => {
  it('uses the tooth difference for opposite slow output, including a full and half input turn', () => {
    const model = createHarmonicModel(defaults);
    expect(model.metrics.ratio).toBe(-100);
    expect(kinematics(model, TAU, 1200).outputAngleRad).toBeCloseTo((-2 * TAU) / 200, 14);
    expect(kinematics(model, Math.PI).outputAngleRad).toBeCloseTo(-TAU / 200, 14);
    expect(kinematics(model, TAU, 1200).outputRpm).toBe(-12);
    expect(kinematics(model, -TAU, -1200).outputRpm).toBe(12);
    expect(rpmToRadiansPerSecond(60)).toBeCloseTo(TAU, 14);
  });
  it('keeps nominal deformation and ratio independent from visual amplification', () => {
    for (const deformationScale of [1, 4, 8]) {
      const model = createHarmonicModel({ ...defaults, deformationScale });
      expect(model.metrics.nominalDeformationMm).toBe(0.5);
      expect(model.metrics.displayDeformationMm).toBe(0.5 * deformationScale);
      expect(model.metrics.ratio).toBe(-100);
      expect(radialDeformationMm(model, 0, 0)).toBe(0.5);
    }
  });
  it('has opposite long-axis maxima and short-axis minima; wave follows input', () => {
    const model = createHarmonicModel(defaults);
    for (const phase of [0, 0.37, Math.PI / 2, 8 * TAU]) {
      expect(radialDeformationMm(model, phase, phase)).toBeCloseTo(0.5, 13);
      expect(radialDeformationMm(model, phase + Math.PI, phase)).toBeCloseTo(0.5, 13);
      expect(radialDeformationMm(model, phase + Math.PI / 2, phase)).toBeCloseTo(-0.5, 13);
      const zones = kinematics(model, phase).engagementAngles;
      expect(zones[1] - zones[0]).toBeCloseTo(Math.PI, 13);
    }
  });
  it('tracks material teeth at output speed, without rigidly rotating the flexspline at input speed', () => {
    const model = createHarmonicModel(defaults);
    const at0 = flexToothPosition(model, 0, 0),
      atQuarter = flexToothPosition(model, 0, Math.PI / 2),
      atFull = flexToothPosition(model, 0, TAU);
    expect(atQuarter.angleRad - at0.angleRad).toBeCloseTo(-Math.PI / 200, 14);
    expect(atFull.angleRad - at0.angleRad).toBeCloseTo(-Math.PI / 50, 14);
    expect(at0.radiusMm).toBeCloseTo(52, 12);
    expect(atQuarter.radiusMm).toBeLessThan(48.01);
    expect(() => flexToothPosition(model, -1, 0)).toThrow();
    expect(() => flexToothPosition(model, 200, 0)).toThrow();
  });
  it('validates every exposed tooth count, forces two-tooth difference and rejects nonfinite/extreme parameters', () => {
    for (let flexTeeth = 80; flexTeeth <= 240; flexTeeth += 2) {
      const model = createHarmonicModel({ ...defaults, flexTeeth, circularTeeth: flexTeeth + 2 });
      expect(model.metrics.ratio).toBe(-flexTeeth / 2);
    }
    for (const patch of [
      { flexTeeth: 79 },
      { flexTeeth: 81 },
      { flexTeeth: 242 },
      { circularTeeth: 200 },
      { circularTeeth: 203 },
      { flexTeeth: NaN },
      { moduleMm: Infinity },
      { moduleMm: 0 },
      { moduleMm: 1e308 },
      { deformationScale: NaN },
      { deformationScale: 0 },
      { deformationScale: 9 },
    ]) {
      expect(validateParameters({ ...defaults, ...patch }).valid).toBe(false);
      expect(() => createHarmonicModel({ ...defaults, ...patch })).toThrow(RangeError);
    }
    expect(() => kinematics(createHarmonicModel(defaults), NaN)).toThrow();
    expect(() => kinematics(createHarmonicModel(defaults), 0, Infinity)).toThrow();
    expect(() => radialDeformationMm(createHarmonicModel(defaults), Infinity, 0)).toThrow();
  });
  it('freezes input snapshots and remains finite for very large finite phase/rpm', () => {
    const parameters = { ...defaults },
      model = createHarmonicModel(parameters);
    parameters.flexTeeth = 80;
    expect(model.parameters.flexTeeth).toBe(200);
    expect(Object.isFrozen(model.parameters)).toBe(true);
    const state = kinematics(model, 1e200, 1e200);
    expect(Object.values(state).flat().every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(radialDeformationMm(model, -1e308, 1e308, true))).toBe(true);
  });
  it('owns all nine named component groups and makes only housing/endcap disappear in mechanism mode', () => {
    const assembly = createHarmonicAssembly();
    try {
      expect(new Set(assembly.parts.map((p) => p.partId))).toEqual(new Set(HARMONIC_PART_IDS));
      expect(new Set(assembly.parts.map((p) => p.mesh.name)).size).toBe(assembly.parts.length);
      assembly.update(0, { stage: 'mechanism' });
      expect(
        assembly.parts
          .filter((p) => !p.mesh.visible)
          .map((p) => p.partId)
          .sort(),
      ).toEqual(['endcap', 'housing']);
      expect(() => assembly.update(0, { explode: -1 })).toThrow();
      expect(() => assembly.update(0, { explode: Infinity })).toThrow();
    } finally {
      assembly.dispose();
    }
    assembly.dispose();
    expect(() => assembly.update(0)).toThrow();
  });
  it('animates actual mesh vertices and independently rotates input and output parts', () => {
    const assembly = createHarmonicAssembly();
    try {
      const flex = assembly.parts.find((p) => p.partId === 'flexspline')!;
      const original = Float32Array.from(flex.mesh.geometry.getAttribute('position').array);
      assembly.update(Math.PI / 2);
      expect(flex.mesh.rotation.z).toBeCloseTo(-Math.PI / 200, 14);
      for (const id of ['input-shaft', 'wave-generator', 'flexible-bearing'])
        expect(assembly.parts.find((p) => p.partId === id)!.mesh.rotation.z).toBe(Math.PI / 2);
      expect(assembly.parts.find((p) => p.partId === 'output-flange')!.mesh.rotation.z).toBeCloseTo(
        -Math.PI / 200,
        14,
      );
      expect(assembly.parts.find((p) => p.partId === 'circular-spline')!.mesh.rotation.z).toBe(0);
      const changed = flex.mesh.geometry.getAttribute('position').array;
      expect(changed.length).toBe(original.length);
      expect(changed.some((value, i) => Math.abs(value - original[i]!) > 0.1)).toBe(true);
      assembly.update(0);
      expect(flex.mesh.geometry.getAttribute('position').array).toEqual(original);
    } finally {
      assembly.dispose();
    }
  });
  for (const flexTeeth of [80, 240])
    for (const moduleMm of [0.1, 2])
      for (const deformationScale of [1, 8]) {
        it(`has finite geometry, true shaft clearance and flange coupling at zf=${flexTeeth},m=${moduleMm},scale=${deformationScale}`, () => {
          const assembly = createHarmonicAssembly({
            flexTeeth,
            circularTeeth: flexTeeth + 2,
            moduleMm,
            deformationScale,
          });
          try {
            for (const phase of [0, Math.PI / 2, TAU, 1e200]) {
              assembly.update(phase, { explode: 0 });
              for (const { mesh } of assembly.parts)
                for (const attribute of Object.values(mesh.geometry.attributes))
                  expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
            }
            const cam = assembly.parts
              .find((p) => p.partId === 'wave-generator')!
              .mesh.geometry.getAttribute('position');
            let minCamRadius = Infinity;
            for (let i = 0; i < cam.count; i++)
              minCamRadius = Math.min(minCamRadius, Math.hypot(cam.getX(i), cam.getY(i)));
            expect(minCamRadius).toBeGreaterThan(assembly.layout.shaftRadiusMm);
            expect(minCamRadius).toBeCloseTo(assembly.layout.shaftRadiusMm * 1.04, 4);
            const flange = assembly.parts.find((p) => p.partId === 'output-flange')!;
            flange.mesh.geometry.computeBoundingBox();
            expect(flange.mesh.geometry.boundingBox!.max.z + flange.mesh.position.z).toBeCloseTo(
              assembly.layout.cupBaseZmm,
              4,
            );
            const maxFlexTip =
              assembly.model.metrics.flexPitchRadiusMm +
              0.6 * moduleMm +
              assembly.model.metrics.displayDeformationMm;
            const minCircularTip = assembly.layout.circularDisplayPitchRadiusMm - 0.6 * moduleMm;
            expect(minCircularTip - maxFlexTip).toBeCloseTo(0.4 * moduleMm, 10);
          } finally {
            assembly.dispose();
          }
        });
      }
});
