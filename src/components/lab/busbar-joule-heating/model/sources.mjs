// Files whose bytes define the S2 model, surrogate and assets. Hashes go into the manifest.
export const SOURCE_FILES = [
  '.node-version',
  'model/l1-half-bridge/params.json',
  'src/components/lab/thermal-stack/viewer-shared.ts',
  ...[
    'geometry.ts',
    'parameters.ts',
    'types.ts',
    'surrogate.ts',
    'evaluator.ts',
    'field.ts',
    'viewer-shared.ts',
    'model/sources.mjs',
    'model/build.mjs',
    'model/render.mjs',
    'model/generate.mjs',
    'model/verify.mjs',
    'model/export-geometry.mjs',
    'model/fem/fem.py',
    'model/fem/common.py',
    'model/fem/validate.py',
    'model/fem/sample.py',
    'model/fem/surrogate.py',
    'model/fem/reproduce.py',
    'model/fem/requirements.txt',
  ].map((name) => `src/components/lab/busbar-joule-heating/${name}`),
];

export const DATA_FILES = [
  'data/samples.csv',
  'data/fields-float16.npz',
  'data/doe.json',
  'reports/analytic-validation.json',
  'reports/mesh-convergence.json',
  'reports/surrogate-validation.json',
].map((name) => `src/components/lab/busbar-joule-heating/model/fem/${name}`);

export const SURROGATE_ASSETS = ['scalar-model.json', 'field-model.json', 'field-basis.f16'].map(
  (name) => `/models/busbar-joule-heating/${name}`,
);
