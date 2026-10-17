// Writes the S2 conductor geometry for a list of (t, b) inputs as JSON for the offline FEM.
// Usage: node --experimental-strip-types export-geometry.mjs <inputs.json> <output.json>
// inputs.json: [{ "thicknessMm": 0.8, "strapWidthMm": 3 }, ...]
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ACTIVE_PATHS, createBusbarGeometry, NOMINAL_GEOMETRY } from '../geometry.ts';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const [inputFile, outputFile] = process.argv.slice(2);
if (!inputFile || !outputFile)
  throw new Error('Usage: export-geometry.mjs <inputs.json> <output.json>');
const inputs = JSON.parse(await readFile(inputFile, 'utf8'));
const l1Bytes = await readFile(path.join(root, 'model/l1-half-bridge/params.json'));
const output = {
  l1ParamsSha256: createHash('sha256').update(l1Bytes).digest('hex'),
  nominal: NOMINAL_GEOMETRY,
  activePaths: ACTIVE_PATHS,
  geometries: inputs.map((input) => createBusbarGeometry(input)),
};
await writeFile(outputFile, JSON.stringify(output));
