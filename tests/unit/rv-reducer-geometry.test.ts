import { describe, expect, it } from 'vitest';
import { createRvAssembly } from '../../src/components/lab/rv-reducer/geometry';
import {
  RV_DEFAULT_PARAMETERS,
  RV_PART_IDS,
  deriveRvLayout,
  prepareRvParameters,
} from '../../src/components/lab/rv-reducer/params';
import * as rv from '../../src/components/lab/rv-reducer/math';

const defaults = RV_DEFAULT_PARAMETERS;

describe('RV actual assembly and parameter domain', () => {
  it('contains named finite independently selectable geometry for every semantic component', () => {
    const assembly = createRvAssembly();
    try {
      expect(assembly.parts).toHaveLength(79);
      expect(new Set(assembly.parts.map((part) => part.id)).size).toBe(79);
      expect(new Set(assembly.parts.map((part) => part.partId))).toEqual(new Set(RV_PART_IDS));
      expect(assembly.parts.filter((part) => part.partId === 'pin')).toHaveLength(40);
      expect(assembly.parts.filter((part) => part.partId === 'cycloid-disc')).toHaveLength(2);
      for (const part of assembly.parts) {
        const positions = part.mesh.geometry.getAttribute('position');
        expect(positions.count).toBeGreaterThan(2);
        expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
        expect(part.mesh.userData.partId).toBe(part.partId);
      }
    } finally {
      assembly.dispose();
    }
  });
  it('keeps all six actual journals, needle bearings, and disc structural holes coincident during a crank revolution', () => {
    const assembly = createRvAssembly();
    try {
      for (let phase = 0; phase <= 16; phase++) {
        const angle =
          (((-rv.TAU * phase) / 16) * assembly.model.metrics.ratio) / defaults.lobeCount;
        const state = assembly.update(angle);
        for (const disc of [0, 1] as const)
          for (let planet = 0; planet < 3; planet++) {
            const tag = disc === 0 ? 'a' : 'b';
            const expected = rv.discHoleCenter(assembly.model, state, disc, planet);
            for (const prefix of ['eccentric-journal', 'needle-bearing']) {
              const mesh = assembly.parts.find(
                (part) => part.id === `${prefix}-${tag}-${planet + 1}`,
              )!.mesh;
              expect(
                Math.hypot(mesh.position.x - expected.x, mesh.position.y - expected.y),
              ).toBeLessThan(1e-10);
            }
            const plate = assembly.parts.find((part) => part.id === `cycloid-disc-${tag}`)!.mesh;
            const local = rv.scale(
              rv.unit((rv.TAU * planet) / 3),
              assembly.model.metrics.crankAxisRadiusMm,
            );
            const transformed = rv.add(
              { x: plate.position.x, y: plate.position.y },
              rv.rotate(local, plate.rotation.z),
            );
            expect(rv.length(rv.subtract(transformed, expected))).toBeLessThan(1e-10);
          }
      }
    } finally {
      assembly.dispose();
    }
  });
  it('filters stages, explodes from rest without drift, and disposes each resource once', () => {
    const assembly = createRvAssembly();
    assembly.update(0.91, { stage: 'first', explode: 1 });
    for (const part of assembly.parts) {
      expect(part.mesh.visible).toBe(part.visibleInStages.includes('first'));
      expect(part.mesh.position.z).toBe(Number(part.mesh.userData.restZmm) + part.explodeZmm);
    }
    assembly.update(-1.13, { stage: 'second', explode: 0 });
    for (const part of assembly.parts) {
      expect(part.mesh.visible).toBe(part.visibleInStages.includes('second'));
      expect(part.mesh.position.z).toBe(Number(part.mesh.userData.restZmm));
    }
    let geometryDisposals = 0,
      materialDisposals = 0;
    for (const part of assembly.parts) {
      part.mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
      part.mesh.material.addEventListener('dispose', () => materialDisposals++);
    }
    assembly.dispose();
    assembly.dispose();
    expect(geometryDisposals).toBe(79);
    expect(materialDisposals).toBe(79);
    expect(assembly.scene.children).toHaveLength(0);
    expect(() => assembly.update(0)).toThrow(/disposed/);
  });
  it('rejects the actual 100/300 crank-bearing circle and the exact conservative bore-plus-web boundary', () => {
    const oversized = { ...defaults, sunTeeth: 100, planetTeeth: 300 };
    expect(rv.validateParameters(oversized).valid).toBe(true);
    expect(() => prepareRvParameters(oversized)).toThrow(/bearing holes extend/);
    expect(() => createRvAssembly(oversized)).toThrow(/bearing holes extend/);
    // a=m*(10+30)/2, needle outer radius=0.21*a; guard includes a full 1 mm web.
    const boundaryModule = (77 - 1) / (20 * 1.21);
    const nearInside = rv.createRvModel({ ...defaults, spurModuleMm: boundaryModule - 1e-6 });
    const nearOutside = rv.createRvModel({ ...defaults, spurModuleMm: boundaryModule + 1e-6 });
    // The bearing/web guard passes just inside; a separate post/flange guard is stricter here.
    expect(() => deriveRvLayout(nearInside)).toThrow(/Carrier posts extend/);
    const postBoundaryModule = 54 / 20;
    expect(() =>
      prepareRvParameters({ ...defaults, spurModuleMm: postBoundaryModule - 1e-6 }),
    ).not.toThrow();
    expect(() =>
      prepareRvParameters({ ...defaults, spurModuleMm: postBoundaryModule + 1e-6 }),
    ).toThrow(/Carrier posts extend/);
    expect(() => deriveRvLayout(nearOutside)).toThrow(/bearing holes extend/);
  });
  it('checks odd/even tooth-space complement on the actual sampled profiles across a full crank cycle', () => {
    let checked = 0;
    for (const patch of [
      {},
      { sunTeeth: 11, planetTeeth: 29, pinCount: 41, lobeCount: 40 },
      { sunTeeth: 9, planetTeeth: 31, pinCount: 39, lobeCount: 38 },
    ]) {
      const { model } = prepareRvParameters({ ...defaults, ...patch });
      const sun = rv.sampleSpurProfile(model, 'sun'),
        planetOutline = rv.sampleSpurProfile(model, 'planet');
      for (let phase = 0; phase <= 16; phase++) {
        const state = rv.kinematics(
          model,
          (-((rv.TAU * phase) / 16 + 0.137) * model.metrics.ratio) / model.parameters.lobeCount,
          73,
        );
        for (let j = 0; j < 3; j++) {
          const planet = rv.planetPose(model, state, j);
          const alpha = state.carrierAngleRad + (rv.TAU * j) / 3;
          const contact = rv.scale(rv.unit(alpha), model.metrics.sun.pitchRadiusMm);
          const sunLocal = rv.rotate(contact, -state.inputAngleRad);
          const planetLocal = rv.rotate(rv.subtract(contact, planet.axisMm), -planet.gearAngleRad);
          expect(rv.polygonContainsPoint(sun, sunLocal)).not.toBe(
            rv.polygonContainsPoint(planetOutline, planetLocal),
          );
          checked++;
        }
        for (const disc of [0, 1] as const)
          for (let pin = 0; pin < model.parameters.pinCount; pin++) {
            const contact = rv.pinContact(model, state, disc, pin);
            expect(rv.length(rv.subtract(contact.pointMm, contact.outlinePointMm))).toBeLessThan(
              1e-9,
            );
            expect(Math.abs(contact.normalVelocityMmPerSecond)).toBeLessThan(1e-9);
          }
      }
    }
    expect(checked).toBe(153);
  });
});

describe('RV conservative adaptive outline', () => {
  it('bounds dense independent samples including the previously missed K=.999 seam', () => {
    for (const k of [60 / 82, 0.9, 0.99, 0.999, 0.999999]) {
      const parameters = { ...defaults, eccentricityMm: (82 / 40) * k };
      if (k > 0.8) parameters.pinRadiusMm = 0.1 / rv.maximumCenterCurveCurvature(parameters);
      const model = rv.createRvModel(parameters),
        profile = rv.sampleAdaptiveCycloidProfile(model);
      expect(profile.maximumChordErrorBoundMm).toBeLessThanOrEqual(profile.toleranceMm);
      // Test 63 non-probe points per accepted interval against its actual chord.
      for (let j = 0; j < profile.verticesPerLobe; j++) {
        const lo = profile.parametersPerLobeRad[j]!,
          hi = profile.parametersPerLobeRad[j + 1]!;
        const a = rv.cycloidPoint(model, lo),
          b = rv.cycloidPoint(model, hi);
        for (let sample = 1; sample < 64; sample++) {
          const error = rv.distanceToSegmentMm(
            rv.cycloidPoint(model, lo + ((hi - lo) * sample) / 64),
            a,
            b,
          );
          expect(error).toBeLessThanOrEqual(profile.maximumChordErrorBoundMm + 1e-10);
        }
      }
      if (k === 0.999) {
        for (const t of [0.00002575, -0.00002575, 0.000003, -0.000003]) {
          const state = rv.kinematics(model, -t * model.metrics.ratio),
            pose = rv.discPose(model, state, 0);
          const localPin = rv.rotate(
            rv.subtract(rv.pinCenter(model, 0), pose.centerMm),
            -pose.outlineAngleRad,
          );
          const gap =
            rv.minimumPolygonDistanceMm(profile.points, localPin) - parameters.pinRadiusMm;
          expect(gap).toBeGreaterThanOrEqual(-profile.toleranceMm - 1e-10);
        }
      }
    }
  });
});
