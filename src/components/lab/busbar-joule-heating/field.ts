import { ACTIVE_PATHS, CONDUCTOR_IDS, type ConductorId } from './geometry.ts';
import {
  normalizedInputs,
  predictGp,
  type CaseKey,
  type GpExport,
  type ScalarModel,
} from './surrogate.ts';
import type { BusbarParams, BusbarResult } from './types.ts';

interface Segment {
  offset: number;
  length: number;
}
export interface FieldModel {
  schema: 1;
  basisSha256: string;
  basisValues: number;
  l1ParamsSha256: string;
  cases: Record<
    CaseKey,
    {
      points: number;
      thetaModes: number;
      jModes: number;
      segments: Record<'thetaMean' | 'thetaModes' | 'jMean' | 'jModes', Segment>;
      thetaCoefficients: GpExport[];
      jCoefficients: GpExport[];
    }
  >;
}

/** Per conductor: temperature rise (K) and current density (A/mm²) at its display lattice. */
export interface ConductorField {
  rise: Float32Array;
  currentDensity: Float32Array;
}
export type FieldSet = Record<ConductorId, ConductorField | null>;

function halfToFloat(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >> 10) & 0x1f;
  const fraction = bits & 0x3ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 31) return fraction ? Number.NaN : sign * Infinity;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

/** Little-endian IEEE half precision to Float32; a 64k lookup keeps decoding short. */
export function decodeFloat16(buffer: ArrayBuffer): Float32Array {
  const source = new Uint16Array(buffer);
  const output = new Float32Array(source.length);
  if (source.length < 4096) {
    for (let index = 0; index < source.length; index += 1)
      output[index] = halfToFloat(source[index]!);
    return output;
  }
  const table = new Float32Array(65536);
  for (let bits = 0; bits < 65536; bits += 1) table[bits] = halfToFloat(bits);
  for (let index = 0; index < source.length; index += 1) output[index] = table[source[index]!]!;
  return output;
}

export interface FieldEvaluator {
  (params: BusbarParams, result: BusbarResult): FieldSet;
}

export function createFieldEvaluator(
  scalar: ScalarModel,
  field: FieldModel,
  basis: Float32Array,
): FieldEvaluator {
  if (field.schema !== 1 || basis.length !== field.basisValues)
    throw new Error('Unsupported field model or basis length.');
  if (field.l1ParamsSha256 !== scalar.l1ParamsSha256)
    throw new Error('Field and scalar models were trained on different L1 geometry.');
  const view = (segment: Segment) =>
    basis.subarray(segment.offset, segment.offset + segment.length);
  const reconstruct = (
    mean: Float32Array,
    modes: Float32Array,
    gps: GpExport[],
    x: number[][],
    u: number[],
  ) => {
    const out = Float32Array.from(mean);
    const n = mean.length;
    gps.forEach((gp, mode) => {
      const a = predictGp(gp, x, u);
      const offset = mode * n;
      for (let index = 0; index < n; index += 1) out[index]! += a * modes[offset + index]!;
    });
    return out;
  };
  return (params, result) => {
    const fields = Object.fromEntries(CONDUCTOR_IDS.map((id) => [id, null])) as FieldSet;
    const u2 = normalizedInputs(scalar.inputs, params.thickness, params.strapWidth);
    const u3 = normalizedInputs(scalar.inputs, params.thickness, params.strapWidth, result.beta);
    const jRef = params.current / (params.strapWidth * params.thickness);
    for (const { conductor } of ACTIVE_PATHS[params.state]) {
      const key = `${params.state}:${conductor}` as CaseKey;
      const entry = field.cases[key];
      const conductorResult = result.conductors[conductor];
      const phiTheta = reconstruct(
        view(entry.segments.thetaMean),
        view(entry.segments.thetaModes),
        entry.thetaCoefficients,
        scalar.x3,
        u3,
      );
      const phiJ = reconstruct(
        view(entry.segments.jMean),
        view(entry.segments.jModes),
        entry.jCoefficients,
        scalar.x2,
        u2,
      );
      const riseScale = conductorResult.riseMax;
      const rise = new Float32Array(phiTheta.length);
      const currentDensity = new Float32Array(phiJ.length);
      for (let index = 0; index < rise.length; index += 1) {
        rise[index] = Math.max(0, riseScale * phiTheta[index]!);
        currentDensity[index] = Math.max(0, jRef * phiJ[index]!);
      }
      fields[conductor] = { rise, currentDensity };
    }
    return fields;
  };
}

let loading: Promise<FieldEvaluator> | undefined;
/** Fetch the local POD field model once; a failed load may be retried. */
export function loadFieldEvaluator(scalar: ScalarModel): Promise<FieldEvaluator> {
  loading ??= (async () => {
    const base = '/models/busbar-joule-heating/';
    const [modelResponse, basisResponse] = await Promise.all([
      fetch(base + 'field-model.json', { credentials: 'same-origin' }),
      fetch(base + 'field-basis.f16', { credentials: 'same-origin' }),
    ]);
    if (!modelResponse.ok || !basisResponse.ok) throw new Error('Field model could not be loaded.');
    const [model, buffer] = await Promise.all([
      modelResponse.json() as Promise<FieldModel>,
      basisResponse.arrayBuffer(),
    ]);
    return createFieldEvaluator(scalar, model, decodeFloat16(buffer));
  })().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
