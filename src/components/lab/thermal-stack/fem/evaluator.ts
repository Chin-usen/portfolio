/** Dependency-free browser inference for the exported FEM-trained surrogate.
 * All lengths are mm; conductivities W/(m K); h W/(m² K); powers W; temperatures °C.
 * Model loading is separate from evaluate(): no fetch, DOM or asynchronous work in inference.
 */
export interface Params {
  t_cooler: number;
  k_cooler: number;
  t_sb: number;
  k_sb: number;
  t_cub: number;
  t_cer: number;
  k_cer: number;
  t_cut: number;
  k_cu: number;
  t_st: number;
  k_st: number;
  h: number;
  P: number;
  T_cool: number;
}
export type ParameterKey = Exclude<keyof Params, 'P' | 'T_cool'>;
interface GPModel {
  type: 'gp';
  kernel: 'rbf' | 'matern52';
  support: number[][];
  lengths: number[];
  alpha: number[][];
  trend: number[][];
  trend_powers?: number[][];
  scale: number[];
}
interface PolynomialModel {
  type: 'polynomial';
  powers: number[][];
  coef: number[][];
}
interface MLPModel {
  type: 'mlp';
  w1: number[][];
  b1: number[];
  w2: number[][];
  b2: number[];
  mean: number[];
  scale: number[];
}
type RegressionModel = GPModel | PolynomialModel | MLPModel;
export interface ScalarModel {
  schema: number;
  kind: string;
  keys: ParameterKey[];
  bounds: number[][];
  feature_kind?: 'log' | 'invariant-log' | 'invariant-linear-thickness';
  scalar_mode:
    | 'direct-log'
    | 'analytic-residual'
    | 'scaled-additive'
    | 'invariant-log'
    | 'flat-residual'
    | 'flat-additive'
    | 'invariant-linear';
  scalar: RegressionModel;
  centre: RegressionModel;
  layer_ids: string[];
  layer_widths_mm: number[];
  data_sha256: string;
}
export interface FieldModel {
  schema: number;
  width: number;
  height: number;
  rank: number;
  model: RegressionModel;
  x_mm: number[];
  layer: number[];
  eta: number[];
  mask: number[];
}
export interface LayerResult {
  id: string;
  name: string;
  rth: number;
  tTop: number;
  tBottom: number;
  thickness: number;
  width: number;
  k: number;
  zBottomMm: number;
  zTopMm: number;
}
export interface FieldResult {
  kind: 'fem-surrogate-central-plane';
  width: number;
  height: number;
  values: Float32Array;
  mask: Uint8Array;
  xMm: Float32Array;
  zMm: Float32Array;
  xMinMm: number;
  xMaxMm: number;
  zMinMm: number;
  zMaxMm: number;
}
export interface Result {
  tjMax: number;
  tjAvg: number;
  rthTotal: number;
  rthAverage: number;
  layers: LayerResult[];
  rConv: number;
  rConvAreaAverage: number;
  totalHeightMm: number;
  tMin: number;
  tMax: number;
  field?: FieldResult;
  model: {
    kind: 'fem-trained-surrogate';
    isFEM: false;
    trainedOnFEM: true;
    peakAndAverageResolvedSeparately: true;
    field: 'fem-surrogate-central-plane' | 'omitted';
    centrelineContributions: true;
    dataSHA256: string;
  };
}
const SQRT5 = Math.sqrt(5);
function predictor(model: RegressionModel): (x: number[]) => number[] {
  if (model.type === 'gp') {
    const n = model.support.length,
      d = model.lengths.length,
      m = model.scale.length;
    const support = Float64Array.from(model.support.flat()),
      alpha = Float64Array.from(model.alpha.flat());
    const inverse = Float64Array.from(model.lengths, (v) => 1 / v),
      scale = Float64Array.from(model.scale);
    const trend = Float64Array.from(model.trend.flat());
    const powers = model.trend_powers ?? [[], ...Array.from({ length: d }, (_, i) => [i])];
    return (x) => {
      const result = new Array<number>(m).fill(0),
        correction = new Float64Array(m);
      for (let term = 0; term < powers.length; term++) {
        let value = 1;
        for (const index of powers[term]!) value *= x[index]!;
        for (let j = 0; j < m; j++) result[j]! += value * trend[term * m + j]!;
      }
      for (let i = 0; i < n; i++) {
        let dist2 = 0;
        for (let k = 0; k < d; k++) {
          const delta = (x[k]! - support[i * d + k]!) * inverse[k]!;
          dist2 += delta * delta;
        }
        const r = Math.sqrt(dist2);
        const weight =
          model.kernel === 'rbf'
            ? Math.exp(-0.5 * dist2)
            : (1 + SQRT5 * r + (5 * dist2) / 3) * Math.exp(-SQRT5 * r);
        for (let j = 0; j < m; j++) correction[j]! += weight * alpha[i * m + j]!;
      }
      for (let j = 0; j < m; j++) result[j]! += correction[j]! * scale[j]!;
      return result;
    };
  }
  if (model.type === 'polynomial')
    return (x) => {
      const m = model.coef[0]!.length,
        result = new Array<number>(m).fill(0);
      for (let i = 0; i < model.powers.length; i++) {
        let term = 1;
        for (const k of model.powers[i]!) term *= x[k]!;
        for (let j = 0; j < m; j++) result[j]! += term * model.coef[i]![j]!;
      }
      return result;
    };
  return (x) => {
    const hidden = model.b1.map((b, j) =>
      Math.tanh(b + x.reduce((sum, v, k) => sum + v * model.w1[k]![j]!, 0)),
    );
    return model.b2.map(
      (b, j) =>
        (b + hidden.reduce((sum, v, k) => sum + v * model.w2[k]![j]!, 0)) * model.scale[j]! +
        model.mean[j]!,
    );
  };
}
function physical(p: Params) {
  return {
    t: [p.t_cooler, p.t_sb, p.t_cub, p.t_cer, p.t_cut, p.t_st, 0.18],
    k: [p.k_cooler, p.k_sb, p.k_cu, p.k_cer, p.k_cu, p.k_st, 370],
  };
}
function baseline(p: Params): number[] {
  const { t, k } = physical(p),
    width = [30, 10, 10, 12, 10, 5, 5],
    r = new Array<number>(8).fill(0);
  let side = 5;
  for (let j = 6; j >= 1; j--) {
    const end = Math.min(side + 2 * t[j]!, width[j]!);
    r[j + 1] = (t[j]! * 1000) / (k[j]! * side * end);
    side = end;
  }
  const a = (side * 0.001) / Math.sqrt(Math.PI),
    b = 0.03 / Math.sqrt(Math.PI),
    eps = a / b;
  const tau = (t[0]! * 0.001) / b,
    bi = (p.h * b) / k[0]!,
    lambda = Math.PI + 1 / (Math.sqrt(Math.PI) * eps);
  const tangent = Math.tanh(lambda * tau),
    phi = (tangent + lambda / bi) / (1 + (lambda / bi) * tangent);
  r[0] = 1 / (p.h * 0.0009);
  r[1] =
    ((1 - eps) ** 1.5 * phi) / (Math.sqrt(Math.PI) * k[0]! * a) +
    (t[0]! * 0.001) / (k[0]! * Math.PI * b * b);
  return r;
}
function half(value: number): number {
  const sign = value & 0x8000 ? -1 : 1,
    exponent = (value >> 10) & 31,
    mantissa = value & 1023;
  if (exponent === 31) return mantissa ? NaN : sign * Infinity;
  return exponent === 0
    ? sign * 2 ** -14 * (mantissa / 1024)
    : sign * 2 ** (exponent - 15) * (1 + mantissa / 1024);
}
/** Decode once at load time. Endianness is explicit; no platform-specific Float16Array required. */
export function decodeFieldBasis(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength % 2) throw new Error('Truncated float16 model');
  const view = new DataView(buffer),
    output = new Float32Array(buffer.byteLength / 2);
  for (let i = 0; i < output.length; i++) output[i] = half(view.getUint16(i * 2, true));
  return output;
}
/** Create a reusable evaluator. Field assets are optional; scalar-only use has the smallest cost. */
export function createEvaluator(
  model: ScalarModel,
  fieldModel?: FieldModel,
  fieldBasis?: Float32Array,
) {
  if (model.schema !== 1 || model.keys.length !== 12) throw new Error('Unsupported scalar model');
  if ((fieldModel === undefined) !== (fieldBasis === undefined))
    throw new Error('Supply both field metadata and decoded basis');
  if (
    fieldModel &&
    fieldBasis!.length !== (fieldModel.rank + 1) * fieldModel.width * fieldModel.height
  )
    throw new Error('Field basis shape mismatch');
  const scalar = predictor(model.scalar),
    centre = predictor(model.centre),
    field = fieldModel ? predictor(fieldModel.model) : undefined;
  const kind = model.feature_kind ?? 'log',
    invariant = kind.startsWith('invariant');
  const transforms = model.keys.flatMap((key, i) => {
    if (invariant && key === 'k_cu') return [];
    const ratio = invariant && (key.startsWith('k_') || key === 'h');
    const low = model.bounds[i]![0]! / (ratio ? model.bounds[8]![1]! : 1);
    const high = model.bounds[i]![1]! / (ratio ? model.bounds[8]![0]! : 1);
    const logarithmic = !(kind.endsWith('linear-thickness') && key.startsWith('t_'));
    return [
      {
        index: i,
        ratio,
        logarithmic,
        low: logarithmic ? Math.log(low) : low,
        range: logarithmic ? Math.log(high / low) : high - low,
      },
    ];
  });
  return function evaluate(p: Params, options: { includeField?: boolean } = {}): Result {
    if (!Number.isFinite(p.P) || p.P < 0 || !Number.isFinite(p.T_cool))
      throw new RangeError('Power must be nonnegative and coolant temperature finite');
    const inputs = model.keys.map((key, i) => {
      const v = p[key],
        b = model.bounds[i]!;
      if (!Number.isFinite(v) || v < b[0]! || v > b[1]!)
        throw new RangeError(`${key} outside validated parameter range [${b[0]}, ${b[1]}]`);
      return v;
    });
    const x = transforms.map((t) => {
      const value = inputs[t.index]! / (t.ratio ? p.k_cu : 1);
      return (2 * ((t.logarithmic ? Math.log(value) : value) - t.low)) / t.range - 1;
    });
    const base = baseline(p),
      prediction = scalar(x);
    let baseTotal = base.reduce((s, v) => s + v, 0);
    if (model.scalar_mode.startsWith('flat-')) {
      const { t, k } = physical(p);
      const widths = [30, 10, 10, 12, 10, 5, 5];
      baseTotal =
        1 / (p.h * 0.0009) +
        t.reduce((sum, v, i) => sum + (v * 1000) / (k[i]! * widths[i]! ** 2), 0);
    }
    const decode = (value: number) => {
      if (model.scalar_mode === 'invariant-linear') return (value * 1000) / p.k_cu;
      if (model.scalar_mode === 'scaled-additive' || model.scalar_mode === 'flat-additive')
        return baseTotal + (value * 1000) / p.k_cu;
      if (model.scalar_mode === 'invariant-log') return (Math.exp(value) * 1000) / p.k_cu;
      return (
        Math.exp(value) *
        (model.scalar_mode === 'analytic-residual' || model.scalar_mode === 'flat-residual'
          ? baseTotal
          : 1)
      );
    };
    const rthTotal = decode(prediction[0]!),
      rthAverage = Math.min(rthTotal, decode(prediction[1]!));
    const correction = centre(x),
      parts = base.map((v, i) => v * Math.exp(correction[i]!));
    const closure = rthTotal / parts.reduce((s, v) => s + v, 0);
    for (let i = 0; i < parts.length; i++) parts[i]! *= closure;
    const { t, k } = physical(p),
      bottoms: number[] = [],
      layers: LayerResult[] = [];
    let z = 0,
      temperature = p.T_cool + p.P * parts[0]!;
    for (let i = 0; i < 7; i++) {
      bottoms.push(z);
      const top = temperature + p.P * parts[i + 1]!;
      layers.push({
        id: model.layer_ids[i]!,
        name: model.layer_ids[i]!,
        rth: parts[i + 1]!,
        tBottom: temperature,
        tTop: top,
        thickness: t[i]!,
        width: model.layer_widths_mm[i]!,
        k: k[i]!,
        zBottomMm: z,
        zTopMm: z + t[i]!,
      });
      z += t[i]!;
      temperature = top;
    }
    const result: Result = {
      tjMax: p.T_cool + p.P * rthTotal,
      tjAvg: p.T_cool + p.P * rthAverage,
      rthTotal,
      rthAverage,
      layers: layers.reverse(),
      rConv: parts[0]!,
      rConvAreaAverage: 1 / (p.h * 0.0009),
      totalHeightMm: z,
      tMin: p.T_cool,
      tMax: p.T_cool + p.P * rthTotal,
      model: {
        kind: 'fem-trained-surrogate',
        isFEM: false,
        trainedOnFEM: true,
        peakAndAverageResolvedSeparately: true,
        field: 'omitted',
        centrelineContributions: true,
        dataSHA256: model.data_sha256,
      },
    };
    if (options.includeField !== false && fieldModel && fieldBasis && field) {
      const coeff = field(x),
        count = fieldModel.width * fieldModel.height,
        values = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        if (!fieldModel.mask[i]) {
          values[i] = p.T_cool;
          continue;
        }
        let normalized = fieldBasis[i]!;
        for (let j = 0; j < fieldModel.rank; j++)
          normalized += coeff[j]! * fieldBasis[(j + 1) * count + i]!;
        values[i] = p.T_cool + p.P * rthTotal * normalized;
      }
      const zMm = Float32Array.from(
        fieldModel.layer,
        (layer, row) => bottoms[layer]! + fieldModel.eta[row]! * t[layer]!,
      );
      result.field = {
        kind: 'fem-surrogate-central-plane',
        width: fieldModel.width,
        height: fieldModel.height,
        values,
        mask: Uint8Array.from(fieldModel.mask),
        xMm: Float32Array.from(fieldModel.x_mm),
        zMm,
        xMinMm: -15,
        xMaxMm: 15,
        zMinMm: 0,
        zMaxMm: z,
      };
      result.model.field = 'fem-surrogate-central-plane';
    }
    return result;
  };
}
