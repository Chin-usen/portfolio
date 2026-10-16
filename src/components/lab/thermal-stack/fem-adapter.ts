import {
  createEvaluator,
  decodeFieldBasis,
  type FieldModel,
  type ScalarModel,
} from './fem/evaluator';
import { validateParams } from './parameters';
import type { ThermalLayerId, ThermalParams, ThermalResult } from './types';

export type FemEvaluator = (params: ThermalParams) => ThermalResult;
const layerIds = new Set<ThermalLayerId>([
  'chip',
  'solder-top',
  'copper-top',
  'ceramic',
  'copper-bottom',
  'solder-bottom',
  'cooler',
]);
let loading: Promise<FemEvaluator> | undefined;

function layerId(value: string | undefined): ThermalLayerId {
  if (!value || !layerIds.has(value as ThermalLayerId))
    throw new Error('Unsupported FEM layer identifier.');
  return value as ThermalLayerId;
}

async function asset(name: string): Promise<Response> {
  const response = await fetch(`/models/thermal/${name}`, { credentials: 'same-origin' });
  if (!response.ok)
    throw new Error(`Thermal model asset could not be loaded (${response.status}).`);
  return response;
}

/** Load local model assets once; a failed load can be retried. No solver runs in the browser. */
export function loadFemEvaluator(): Promise<FemEvaluator> {
  loading ??= (async () => {
    const [scalarResponse, fieldResponse, binaryResponse] = await Promise.all([
      asset('scalar-model.json'),
      asset('field-model.json'),
      asset('field-basis.f16'),
    ]);
    const [scalar, field, binary] = await Promise.all([
      scalarResponse.json() as Promise<ScalarModel>,
      fieldResponse.json() as Promise<FieldModel>,
      binaryResponse.arrayBuffer(),
    ]);
    if (
      scalar.schema !== 1 ||
      field.schema !== 1 ||
      field.width !== 128 ||
      field.height !== 64 ||
      scalar.layer_ids.length !== 7
    ) {
      throw new Error('Unsupported thermal model schema or field dimensions.');
    }
    const physicalIds = scalar.layer_ids.map(layerId);
    if (new Set(physicalIds).size !== 7) throw new Error('FEM model layers must be distinct.');
    const rowLayerIds = field.layer.map((index) => layerId(scalar.layer_ids[index]));
    if (
      rowLayerIds.length !== field.height ||
      field.x_mm.length !== field.width ||
      field.mask.length !== field.width * field.height
    ) {
      throw new Error('Invalid FEM field coordinates or mask.');
    }
    const predict = createEvaluator(scalar, field, decodeFieldBasis(binary));
    return (input: ThermalParams): ThermalResult => {
      const params = validateParams(input);
      const predicted = predict(params, { includeField: true });
      const values = [predicted.tjMax, predicted.tjAvg, predicted.rthTotal, predicted.rConv];
      if (!values.every(Number.isFinite) || predicted.rthTotal <= 0 || !predicted.field) {
        throw new Error('FEM surrogate returned an invalid prediction.');
      }
      return {
        ...predicted,
        layers: predicted.layers.map((layer) => ({ ...layer, id: layerId(layer.id) })),
        field: { ...predicted.field, rowLayerIds },
      };
    };
  })().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
