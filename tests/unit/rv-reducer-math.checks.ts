import * as rv from '../../src/components/lab/rv-reducer/math.ts';
import type { RvParameters, Point2, DiscIndex } from '../../src/components/lab/rv-reducer/math.ts';

export interface MathCheck {
  name: string;
  run: () => Record<string, unknown> | void;
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function near(
  actual: number,
  expected: number,
  tolerance = 1e-9,
  message = 'numeric equality',
): void {
  assert(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} versus ${expected}; tolerance ${tolerance}`,
  );
}
function nearPoint(
  actual: Point2,
  expected: Point2,
  tolerance = 1e-9,
  message = 'point equality',
): void {
  near(rv.length(rv.subtract(actual, expected)), 0, tolerance, message);
}
function throws(body: () => unknown, message: string): void {
  let didThrow = false;
  try {
    body();
  } catch {
    didThrow = true;
  }
  assert(didThrow, message);
}
/** Independent invariant checks shared by Node and Vitest; no renderer or Node imports. */
export function createMathChecks(parameters: RvParameters): MathCheck[] {
  const model = rv.createRvModel(parameters),
    p = model.parameters;
  const phases = [0, 0.137, -1.731, 2.9, -29.7, 121 * rv.TAU];
  return [
    {
      name: 'unwrapped ratio, direction and both velocity constraints',
      run() {
        near(model.metrics.ratio, 121, 0);
        for (const angle of phases)
          for (const rpm of [0, 1200, -473]) {
            const s = rv.kinematics(model, angle, rpm);
            near(
              p.sunTeeth * (s.inputRadPerSecond - s.outputRadPerSecond) +
                p.planetTeeth * (s.crankRadPerSecond - s.outputRadPerSecond),
              0,
              1e-9,
              'external mesh velocity',
            );
            near(
              p.lobeCount * (s.outputRadPerSecond - s.crankRadPerSecond),
              p.pinCount * -s.crankRadPerSecond,
              1e-9,
              'cycloid velocity',
            );
            near(s.crankRelativeToCarrierRad, -p.pinCount * s.carrierAngleRad, 1e-12);
            if (rpm)
              assert(
                Math.sign(s.outputRpm) === Math.sign(rpm) &&
                  Math.sign(s.crankRpm) === -Math.sign(rpm),
                'rotation directions',
              );
          }
        const closed = rv.kinematics(model, 121 * rv.TAU, 1210);
        near(closed.carrierAngleRad, rv.TAU);
        near(closed.crankAngleRad, -39 * rv.TAU);
        near(closed.crankRelativeToCarrierRad, -40 * rv.TAU);
        near(closed.outputRpm, 10);
        near(closed.crankRpm, -390);
        near(closed.crankRelativeToCarrierRpm, -400);
        near(rv.rpmToRadiansPerSecond(60), rv.TAU);
        throws(() => rv.kinematics(model, Number.NaN), 'reject nonfinite input');
      },
    },
    {
      name: 'individually keyed gear phases and three-planet mesh parity',
      run() {
        for (const angle of phases) {
          const s = rv.kinematics(model, angle);
          for (let j = 0; j < 3; j++) {
            const planet = rv.planetPose(model, s, j),
              alpha = s.carrierAngleRad + (rv.TAU * j) / 3;
            near(
              rv.wrapSigned(
                p.sunTeeth * angle +
                  p.planetTeeth * planet.gearAngleRad -
                  (p.sunTeeth + p.planetTeeth) * alpha -
                  Math.PI,
              ),
              0,
              1e-10,
              'tooth mesh phase',
            );
            near(
              planet.gearAngleRad - planet.crankAngleRad,
              planet.fixedGearToCrankIndexRad,
              1e-12,
            );
          }
        }
        const identicalBadPhaseResidual = rv.wrapSigned(
          (-(p.sunTeeth + p.planetTeeth) * rv.TAU) / 3,
        );
        assert(
          Math.abs(identicalBadPhaseResidual) > 1,
          'equal gear-to-crank phase must visibly fail',
        );
        // The generalized helper handles odd planet tooth parity as well.
        const odd = rv.createRvModel({ ...parameters, planetTeeth: 29 }),
          s = rv.kinematics(odd, 0.91);
        for (let j = 0; j < 3; j++) {
          const pose = rv.planetPose(odd, s, j),
            alpha = s.carrierAngleRad + (rv.TAU * j) / 3;
          near(
            rv.wrapSigned(
              10 * s.inputAngleRad + 29 * pose.gearAngleRad - 39 * alpha - (29 + 1) * Math.PI,
            ),
            0,
            1e-10,
          );
        }
      },
    },
    {
      name: 'two disc indexes, parallel eccentrics and all six rigid hole closures',
      run() {
        for (const angle of phases) {
          const s = rv.kinematics(model, angle),
            a = rv.discPose(model, s, 0),
            b = rv.discPose(model, s, 1);
          nearPoint(rv.add(a.centerMm, b.centerMm), { x: 0, y: 0 });
          near(rv.length(a.centerMm), p.eccentricityMm);
          near(b.outlineAngleRad - a.outlineAngleRad, -Math.PI / 39);
          near(b.structuralAngleRad, a.structuralAngleRad, 0);
          for (const disc of [0, 1] as const)
            for (let j = 0; j < 3; j++) {
              const pose = rv.discPose(model, s, disc),
                axis = rv.planetPose(model, s, j).axisMm;
              const hole = rv.discHoleCenter(model, s, disc, j),
                journal = rv.crankJournalCenter(model, s, disc, j);
              nearPoint(hole, journal, 1e-10);
              near(rv.length(rv.subtract(hole, axis)), p.eccentricityMm);
              nearPoint(rv.subtract(journal, axis), pose.centerMm);
              const rigidLocal = rv.rotate(rv.subtract(hole, pose.centerMm), -s.carrierAngleRad);
              nearPoint(
                rigidLocal,
                rv.scale(rv.unit((rv.TAU * j) / 3), model.metrics.crankAxisRadiusMm),
                1e-10,
              );
            }
        }
        throws(
          () => rv.planetPose(model, rv.kinematics(model, 0), 3),
          'reject nonexistent fourth crank',
        );
      },
    },
    {
      name: 'closed finite CCW outline, 39-lobe symmetry and tangent closure',
      run() {
        const points = rv.sampleCycloidProfile(model);
        assert(points.length === 39 * 64 + 1, 'full outline vertex count');
        nearPoint(points[0]!, points.at(-1)!, 0, 'exact repeated closing point');
        assert(
          points.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)),
          'finite profile',
        );
        nearPoint(rv.cycloidPoint(model, 0), rv.cycloidPoint(model, rv.TAU), 1e-10);
        nearPoint(rv.cycloidTangent(model, 0), rv.cycloidTangent(model, rv.TAU), 1e-8);
        for (let j = 0; j < 29; j++) {
          const t = j * 0.08713;
          nearPoint(
            rv.cycloidPoint(model, t + rv.TAU / 39),
            rv.rotate(rv.cycloidPoint(model, t), rv.TAU / 39),
            1e-10,
            'one lobe rotational symmetry',
          );
        }
        assert(rv.signedArea(points) > 18000, 'positive full-disc area, not one-lobe slice');
        near(rv.length(points[0]!), 82 - 1.5 - 3.5, 1e-12);
        return { vertices: points.length, signedAreaMm2: rv.signedArea(points) };
      },
    },
    {
      name: 'analytic offset derivative, curvature maximum and regularity',
      run() {
        let sampledMaximum = -Infinity,
          minimumRegularity = Infinity;
        for (let j = 0; j <= 4096; j++) {
          const t = ((rv.TAU / 39) * j) / 4096,
            q = rv.centerCurveGeometry(model, t);
          sampledMaximum = Math.max(sampledMaximum, q.curvaturePerMm);
          minimumRegularity = Math.min(minimumRegularity, 1 - p.pinRadiusMm * q.curvaturePerMm);
        }
        const exactMaximum = model.metrics.maximumCenterCurveCurvaturePerMm;
        assert(
          exactMaximum >= sampledMaximum - 1e-12 && exactMaximum - sampledMaximum < 1e-6,
          'exact curvature extremum bounds sampled value',
        );
        assert(
          minimumRegularity > 0 && model.metrics.offsetRegularityMargin > 0,
          'no local offset cusp',
        );
        for (const t of [0.003, 0.029, 0.081, 0.143, 2.318]) {
          const h = 1e-7,
            finiteDifference = rv.scale(
              rv.subtract(rv.cycloidPoint(model, t + h), rv.cycloidPoint(model, t - h)),
              1 / (2 * h),
            );
          nearPoint(
            finiteDifference,
            rv.cycloidTangent(model, t),
            3e-6,
            'analytic derivative versus central difference',
          );
        }
        return {
          exactMaximumCurvaturePerMm: exactMaximum,
          sampledMaximumCurvaturePerMm: sampledMaximum,
          minimumRegularity,
        };
      },
    },
    {
      name: 'all pin tangencies, orthogonal normals and no normal penetration on both discs',
      run() {
        let contacts = 0,
          maxPointErrorMm = 0,
          maxNormalVelocityMmPerSecond = 0;
        for (const angle of [...phases, 0.019, 10.13, -5.29])
          for (const rpm of [1200, -473]) {
            const s = rv.kinematics(model, angle, rpm);
            for (const disc of [0, 1] as const)
              for (let pin = 0; pin < p.pinCount; pin++) {
                const contact = rv.pinContact(model, s, disc, pin),
                  pose = rv.discPose(model, s, disc);
                const error = rv.length(rv.subtract(contact.pointMm, contact.outlinePointMm));
                maxPointErrorMm = Math.max(maxPointErrorMm, error);
                maxNormalVelocityMmPerSecond = Math.max(
                  maxNormalVelocityMmPerSecond,
                  Math.abs(contact.normalVelocityMmPerSecond),
                );
                near(error, 0, 2e-9, 'analytic conjugate contact');
                near(
                  rv.length(rv.subtract(contact.pinCenterMm, contact.outlinePointMm)),
                  p.pinRadiusMm,
                  2e-9,
                  'physical pin radius',
                );
                near(
                  rv.dot(contact.normal, contact.tangent) / rv.length(contact.tangent),
                  0,
                  1e-10,
                  'normal perpendicular tangent',
                );
                near(contact.normalVelocityMmPerSecond, 0, 1e-8, 'normal material velocity');
                const expectedSpin =
                  (-s.outputRadPerSecond *
                    (rv.length(
                      rv.subtract(contact.pinCenterMm, rv.scale(pose.centerMm, p.pinCount)),
                    ) -
                      p.pinRadiusMm)) /
                  p.pinRadiusMm;
                assert(
                  contact.independentPinMatchingRpm !== null,
                  'nominal hypothetical pin spin is available',
                );
                near(
                  rv.rpmToRadiansPerSecond(contact.independentPinMatchingRpm),
                  expectedSpin,
                  1e-9,
                );
                assert(contact.exactNominalTangency, 'default has zero normal relief');
                contacts++;
              }
          }
        // A shared long pin cannot generally match both individually required spins.
        const state = rv.kinematics(model, 1.7, 1200);
        const a = rv.pinContact(model, state, 0, 0),
          b = rv.pinContact(model, state, 1, 0);
        assert(
          a.independentPinMatchingRpm !== null && b.independentPinMatchingRpm !== null,
          'nominal isolated pin spins exist',
        );
        assert(
          Math.abs(a.independentPinMatchingRpm - b.independentPinMatchingRpm) > 1,
          'two-disc shared pin rolling incompatibility',
        );
        // Deliberate missing index must fail independently of the correct helper.
        const pose = rv.discPose(model, state, 1),
          bad = rv.add(
            pose.centerMm,
            rv.rotate(
              rv.cycloidPoint(model, (rv.TAU * 0) / p.pinCount - state.carrierAngleRad),
              state.carrierAngleRad,
            ),
          );
        assert(
          rv.length(rv.subtract(bad, b.pointMm)) > 0.1,
          'missing second-disc half-lobe index is detectable',
        );
        return {
          contacts,
          maxPointErrorMm,
          maxNormalVelocityMmPerSecond,
          sharedPinSpinDifferenceRpm: Math.abs(
            a.independentPinMatchingRpm - b.independentPinMatchingRpm,
          ),
        };
      },
    },
    {
      name: 'reject invalid integer, clearance, cusp, undercut and sample bounds',
      run() {
        const bad: Array<[Partial<RvParameters>, string]> = [
          [{ sunTeeth: 10.5 }, 'INTEGER_BOUNDS'],
          [{ planetTeeth: -1 }, 'INTEGER_BOUNDS'],
          [{ pinCount: 513, lobeCount: 512 }, 'INTEGER_BOUNDS'],
          [{ pinCount: 2, lobeCount: 1 }, 'LOBE_DIFFERENCE'],
          [{ lobeCount: 40 }, 'LOBE_DIFFERENCE'],
          [{ planetCount: 4 }, 'PLANET_COUNT'],
          [{ eccentricityMm: 0 }, 'POSITIVE_FINITE'],
          [{ pinCircleRadiusMm: NaN }, 'POSITIVE_FINITE'],
          [{ eccentricityMm: 82 / 40 }, 'K1'],
          [{ eccentricityMm: 3 }, 'K1'],
          [{ pinRadiusMm: 7 }, 'PIN_CLEARANCE'],
          [{ normalReliefMm: 4 }, 'OFFSET_CUSP'],
          [{ eccentricityMm: 2, pinRadiusMm: 3.5 }, 'OFFSET_CUSP'],
          [{ planetTeeth: 100 }, 'PLANET_CLEARANCE'],
          [{ pressureAngleRad: Math.PI / 9 }, 'SPUR_UNDERCUT'],
          [{ normalReliefMm: -0.1 }, 'RELIEF'],
          [{ pressureAngleRad: 0 }, 'PRESSURE_ANGLE'],
          [{ profileSamplesPerLobe: 3 }, 'SAMPLE_BOUNDS'],
          [{ gearFlankSamples: Infinity }, 'SAMPLE_BOUNDS'],
          [{ dedendumCoefficient: 0.1 }, 'SPUR_RADIAL_CLEARANCE'],
          [{ spurModuleMm: 1e308 }, 'DERIVED_NONFINITE'],
          [{ spurModuleMm: 1e307 }, 'DERIVED_NONFINITE'],
          [{ profileChordToleranceMm: 1e-10 }, 'CHORD_TOLERANCE'],
          [{ dedendumCoefficient: 8 }, 'SPUR_ROOT'],
          [{ addendumCoefficient: 2 }, 'SPUR_TIP'],
        ];
        for (const [patch, code] of bad) {
          const candidate = { ...parameters, ...patch },
            result = rv.validateParameters(candidate);
          assert(
            !result.valid && result.issues.some((i) => i.code === code),
            `expected ${code} for ${JSON.stringify(patch)}; got ${JSON.stringify(result.issues)}`,
          );
          throws(() => rv.createRvModel(candidate), `create must reject ${code}`);
        }
        return { rejectedParameterCases: bad.length };
      },
    },
    {
      name: 'K1 near valid upper limit remains finite without clamping',
      run() {
        const close = { ...parameters, eccentricityMm: (82 / 40) * (1 - 1e-6) };
        close.pinRadiusMm = 0.1 / rv.maximumCenterCurveCurvature(close);
        const nearModel = rv.createRvModel(close),
          curve = rv.sampleCycloidProfile(nearModel);
        assert(
          curve.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)),
          'finite near-bound profile',
        );
        near(nearModel.metrics.k1, 1 - 1e-6, 1e-15);
        near(nearModel.metrics.offsetRegularityMargin, 0.9, 1e-12);
        const invalid = rv.validateParameters({ ...close, eccentricityMm: (82 / 40) * (1 - 1e-9) });
        assert(
          !invalid.valid && invalid.issues.some((i) => i.code === 'K1'),
          'enforce documented numerical margin',
        );
        return { k1: nearModel.metrics.k1, adaptedPinRadiusMm: close.pinRadiusMm };
      },
    },
    {
      name: 'global polygon self-intersection detects crossings/touches and accepts outlines',
      run() {
        assert(
          rv.findSelfIntersection([
            { x: 0, y: 0 },
            { x: 2, y: 2 },
            { x: 0, y: 2 },
            { x: 2, y: 0 },
          ]) !== null,
          'bow-tie crossing caught',
        );
        assert(
          rv.findSelfIntersection([
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
          ]) !== null,
          'nonadjacent touching caught',
        );
        for (const samples of [32, 64, 128]) {
          const result = rv.validateSampledProfiles(model, samples);
          assert(result.valid, `sampled profile ${samples}: ${JSON.stringify(result.issues)}`);
        }
      },
    },
    {
      name: '30-degree involute dimensions, pitch thickness and separate root transitions',
      run() {
        near(p.pressureAngleRad, Math.PI / 6, 0);
        near(model.metrics.contactRatio, 1.2842591988553762, 1e-12);
        near(model.metrics.noUndercutMinimumTeeth, 8, 1e-12);
        assert(
          model.metrics.sun.rootRadiusMm < model.metrics.sun.baseRadiusMm,
          'sun root lies below base circle',
        );
        for (const name of ['sun', 'planet'] as const) {
          const g = model.metrics[name],
            outline = rv.sampleSpurProfile(model, name);
          near(
            2 * g.pitchRadiusMm * rv.spurHalfThicknessRad(g, p.pressureAngleRad, g.pitchRadiusMm),
            (Math.PI * p.spurModuleMm) / 2,
            1e-12,
            'standard pitch-circle tooth thickness',
          );
          const radii = outline.map(rv.length);
          near(Math.min(...radii), g.rootRadiusMm, 1e-10);
          near(Math.max(...radii), g.tipRadiusMm, 1e-10);
          assert(
            g.tipThicknessMm > 0 && rv.signedArea(outline) > 0,
            'positive top land and winding',
          );
          throws(
            () => rv.spurHalfThicknessRad(g, p.pressureAngleRad, g.baseRadiusMm * 0.999),
            'must not clamp inverse cosine below base circle',
          );
          nearPoint(outline[0]!, outline.at(-1)!, 0);
        }
        return {
          contactRatio: model.metrics.contactRatio,
          sunTipThicknessMm: model.metrics.sun.tipThicknessMm,
          planetTipThicknessMm: model.metrics.planet.tipThicknessMm,
        };
      },
    },
    {
      name: 'normal relief is explicit and cannot be mislabeled exact nominal contact',
      run() {
        const relief = rv.createRvModel({ ...parameters, normalReliefMm: 0.05 }),
          state = rv.kinematics(relief, 2.341, -600);
        for (const disc of [0, 1] as const)
          for (let pin = 0; pin < p.pinCount; pin++) {
            const contact = rv.pinContact(relief, state, disc, pin);
            assert(
              !contact.exactNominalTangency && contact.independentPinMatchingRpm === null,
              'relief must carry nonexact flag and no matching pin spin',
            );
            near(
              rv.length(rv.subtract(contact.outlinePointMm, contact.pointMm)),
              0.05,
              1e-10,
              'normal relief gap',
            );
          }
      },
    },
    {
      name: 'complete crank cycle: both disc planes, every pin, convergent global clearance',
      run() {
        const phases = Array.from({ length: 17 }, (_, i) => (rv.TAU * i) / 16);
        // Include asymmetric/reverse phases beyond the mandated endpoints and quarter cycles.
        phases.push(0.317, -0.731);
        const results: Record<string, unknown>[] = [];
        let coarseMaxChordError = Infinity;
        for (const resolution of [32, 64]) {
          let minimumAnalyticGapMm = Infinity,
            maximumAnalyticGapMm = -Infinity;
          let minimumPolygonGapMm = Infinity,
            maximumChordErrorMm = 0,
            count = 0;
          for (const crankAngle of phases) {
            const state = rv.kinematics(
              model,
              (-crankAngle * model.metrics.ratio) / p.lobeCount,
              1200,
            );
            near(state.crankAngleRad, crankAngle, 1e-12);
            for (const disc of [0, 1] as DiscIndex[])
              for (let pin = 0; pin < p.pinCount; pin++) {
                const result = rv.measurePinClearance(model, state, disc, pin, resolution);
                assert(result.candidateCount > 0, 'global candidate search found a minimum');
                assert(!result.pinCenterInsidePolygon, 'pin center must remain outside disc');
                assert(
                  result.analyticMinimumGapMm >= -1e-7 && result.analyticMinimumGapMm <= 1e-7,
                  `refined global gap ${result.analyticMinimumGapMm}mm`,
                );
                minimumAnalyticGapMm = Math.min(minimumAnalyticGapMm, result.analyticMinimumGapMm);
                maximumAnalyticGapMm = Math.max(maximumAnalyticGapMm, result.analyticMinimumGapMm);
                minimumPolygonGapMm = Math.min(minimumPolygonGapMm, result.polygonMinimumGapMm);
                maximumChordErrorMm = Math.max(
                  maximumChordErrorMm,
                  Math.abs(result.polygonMinimumGapMm - result.analyticMinimumGapMm),
                );
                count++;
              }
          }
          if (resolution === 32) coarseMaxChordError = maximumChordErrorMm;
          else
            assert(
              maximumChordErrorMm < 0.35 * coarseMaxChordError,
              'polygon approximation converges on refinement',
            );
          results.push({
            samplesPerLobe: resolution,
            crankPhases: phases.length,
            pinDiscChecks: count,
            minimumAnalyticGapMm,
            maximumAnalyticGapMm,
            minimumPolygonGapMm,
            maximumChordErrorMm,
          });
        }
        return {
          analyticToleranceMm: 1e-7,
          refinements: results,
          qualification:
            'Numerical candidate-search evidence at stated resolution; not an interval-certified global proof.',
        };
      },
    },
    {
      name: 'adaptive extrusion outline meets declared chord tolerance over the complete crank cycle',
      run() {
        const output: Record<string, unknown>[] = [];
        for (const toleranceMm of [p.profileChordToleranceMm, p.profileChordToleranceMm / 2]) {
          const adaptive = rv.sampleAdaptiveCycloidProfile(model, toleranceMm);
          assert(
            adaptive.maximumSampledChordErrorMm <= toleranceMm,
            'local adaptive chord tolerance',
          );
          assert(
            rv.findSelfIntersection(adaptive.points) === null && rv.signedArea(adaptive.points) > 0,
            'simple CCW adaptive outline',
          );
          nearPoint(adaptive.points[0]!, adaptive.points.at(-1)!, 0, 'closed adaptive outline');
          let minimumPolygonGapMm = Infinity,
            maximumChordErrorMm = 0,
            checks = 0;
          for (let phase = 0; phase <= 16; phase++) {
            const crankAngle = (rv.TAU * phase) / 16,
              state = rv.kinematics(model, (-crankAngle * model.metrics.ratio) / p.lobeCount, 1200);
            for (const disc of [0, 1] as const)
              for (let pin = 0; pin < p.pinCount; pin++) {
                const result = rv.measurePinClearance(model, state, disc, pin, 64, adaptive.points);
                assert(
                  !result.pinCenterInsidePolygon,
                  'adaptive outline leaves pin centers outside',
                );
                assert(
                  Math.abs(result.analyticMinimumGapMm) <= 1e-7,
                  'analytic closest contact stays nominal',
                );
                assert(
                  result.polygonMinimumGapMm >= -toleranceMm - 1e-7,
                  'polygon penetration stays within declared tessellation tolerance',
                );
                minimumPolygonGapMm = Math.min(minimumPolygonGapMm, result.polygonMinimumGapMm);
                maximumChordErrorMm = Math.max(
                  maximumChordErrorMm,
                  Math.abs(result.polygonMinimumGapMm - result.analyticMinimumGapMm),
                );
                checks++;
              }
          }
          assert(
            maximumChordErrorMm <= toleranceMm + 1e-7,
            'global measured chord error stays within tolerance',
          );
          output.push({
            toleranceMm,
            vertices: adaptive.points.length,
            verticesPerLobe: adaptive.verticesPerLobe,
            maximumSampledChordErrorMm: adaptive.maximumSampledChordErrorMm,
            maximumChordErrorBoundMm: adaptive.maximumChordErrorBoundMm,
            minimumPolygonGapMm,
            maximumChordErrorMm,
            pinDiscChecks: checks,
          });
        }
        assert(
          (output[1]!.maximumChordErrorMm as number) <=
            (output[0]!.maximumChordErrorMm as number) + 1e-10,
          'adaptive refinement does not increase sampled global chord error',
        );
        assert(
          (output[1]!.maximumChordErrorBoundMm as number) <
            (output[0]!.maximumChordErrorBoundMm as number),
          'adaptive refinement reduces the conservative error bound',
        );
        assert(
          (output[1]!.vertices as number) > (output[0]!.vertices as number),
          'tighter bound subdivides additional intervals',
        );
        return { refinements: output };
      },
    },
    {
      name: 'uniform length rescaling preserves dimensionless behavior and profile shape',
      run() {
        const factor = 0.5,
          scaled = rv.createRvModel({
            ...parameters,
            pinCircleRadiusMm: p.pinCircleRadiusMm * factor,
            pinRadiusMm: p.pinRadiusMm * factor,
            eccentricityMm: p.eccentricityMm * factor,
            spurModuleMm: p.spurModuleMm * factor,
          });
        near(scaled.metrics.ratio, model.metrics.ratio, 0);
        near(scaled.metrics.k1, model.metrics.k1, 0);
        near(scaled.metrics.contactRatio, model.metrics.contactRatio, 1e-12);
        near(scaled.metrics.offsetRegularityMargin, model.metrics.offsetRegularityMargin, 1e-12);
        for (const t of [0, 0.019, 1.13, 3.5])
          nearPoint(rv.cycloidPoint(scaled, t), rv.scale(rv.cycloidPoint(model, t), factor), 1e-12);
      },
    },
  ];
}
