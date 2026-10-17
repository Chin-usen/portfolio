import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { layerLevels } from '../../model/l1-half-bridge/model';
import l1 from '../../model/l1-half-bridge/params.json';
import {
  caseQuantities,
  evaluate,
  SCALAR_MODEL,
} from '../../src/components/lab/busbar-joule-heating/evaluator';
import {
  createFieldEvaluator,
  decodeFloat16,
  type FieldModel,
} from '../../src/components/lab/busbar-joule-heating/field';
import {
  ACTIVE_PATHS,
  CONDUCTOR_IDS,
  createBusbarGeometry,
  l1LayerLevels,
  latticeOffsets,
  type ConductorBox,
} from '../../src/components/lab/busbar-joule-heating/geometry';
import {
  DEFAULT_PARAMS,
  MATERIAL_PRESETS,
  materialOf,
  validateParams,
} from '../../src/components/lab/busbar-joule-heating/parameters';
import { busbarCopy } from '../../src/components/lab/busbar-joule-heating/copy';
import type { CaseKey } from '../../src/components/lab/busbar-joule-heating/surrogate';
import { buildBoxSurface } from '../../src/components/lab/busbar-joule-heating/viewer-shared';

const fem = path.resolve('src/components/lab/busbar-joule-heating/model/fem');
const publicDir = path.resolve('public/models/busbar-joule-heating');
const corners = [0.5, 3].flatMap((thicknessMm) =>
  [2, 6].map((strapWidthMm) => ({ thicknessMm, strapWidthMm })),
);

function overlap(a: ConductorBox, b: ConductorBox, tolerance = 1e-9) {
  return [0, 1, 2].every(
    (axis) => a.min[axis]! < b.max[axis]! - tolerance && b.min[axis]! < a.max[axis]! - tolerance,
  );
}
function touches(a: ConductorBox, b: ConductorBox) {
  return [0, 1, 2].every(
    (axis) => a.min[axis]! <= b.max[axis]! + 1e-9 && b.min[axis]! <= a.max[axis]! + 1e-9,
  );
}
function readSamples() {
  const lines = readFileSync(path.join(fem, 'data/samples.csv'), 'utf8').trim().split('\n');
  const header = lines[0]!.split(',');
  return lines
    .slice(1)
    .map((line) =>
      Object.fromEntries(line.split(',').map((value, index) => [header[index]!, value])),
    );
}

describe('S2 geometry from the L1 parameter file', () => {
  it('uses L1 dimensions and the same layer levels as the L1 model', () => {
    expect(l1LayerLevels()).toEqual(layerLevels(l1));
    const nominal = createBusbarGeometry();
    expect(nominal.input).toEqual({
      thicknessMm: l1.busbarThickness,
      strapWidthMm: l1.acBridgeWidth,
    });
    const plate = nominal.conductors['p-layer'].boxes.find((item) => item.id === 'p-plate')!;
    expect(plate.max[0] - plate.min[0]).toBe(l1.busbarLength);
    expect(plate.max[1] - plate.min[1]).toBe(l1.busbarOverlapWidth);
    expect(nominal.levels).toMatchObject({
      acBottom: l1.shCollectorBottom,
      nCollectorBottom: l1.slCollectorBottom,
      pBottom: l1.pBusbarBottom,
      nBottom: l1.pBusbarBottom + l1.busbarThickness + l1.busbarGap,
    });
    const bridge = nominal.conductors['ac-link'].boxes.find((item) => item.id === 'ac-bridge')!;
    expect(bridge.max[1] - bridge.min[1]).toBeCloseTo(l1.acBridgeWidth, 12);
  });

  it.each(corners)('keeps each conductor connected and separate at %o', (input) => {
    const geometry = createBusbarGeometry(input);
    for (const id of CONDUCTOR_IDS) {
      const boxes = geometry.conductors[id].boxes;
      const reached = new Set([0]);
      let grew = true;
      while (grew) {
        grew = false;
        boxes.forEach((item, index) => {
          if (!reached.has(index) && [...reached].some((other) => touches(boxes[other]!, item))) {
            reached.add(index);
            grew = true;
          }
        });
      }
      expect(reached.size).toBe(boxes.length);
      for (const pin of geometry.conductors[id].pins)
        expect(
          boxes.some(
            (item) =>
              item.min[2] === pin.value && item.min[0] <= pin.min[0] && item.max[0] >= pin.max[0],
          ),
        ).toBe(true);
    }
    for (const [a, b] of [
      ['p-layer', 'ac-link'],
      ['p-layer', 'n-layer'],
      ['ac-link', 'n-layer'],
    ] as const) {
      for (const first of geometry.conductors[a].boxes)
        for (const second of geometry.conductors[b].boxes)
          expect(overlap(first, second), `${first.id}/${second.id}`).toBe(false);
    }
  });

  it('defines two switching states without a shoot-through path', () => {
    expect(Object.keys(ACTIVE_PATHS).sort()).toEqual(['sh', 'sl']);
    expect(ACTIVE_PATHS.sh.map((item) => item.conductor)).toEqual(['p-layer', 'ac-link']);
    expect(ACTIVE_PATHS.sl.map((item) => item.conductor)).toEqual(['ac-link', 'n-layer']);
    for (const state of ['sh', 'sl'] as const)
      expect(
        ACTIVE_PATHS[state].some((item) => item.conductor === 'p-layer') &&
          ACTIVE_PATHS[state].some((item) => item.conductor === 'n-layer'),
      ).toBe(false);
  });
});

describe('S2 evaluator', () => {
  it('scales exactly with current, conductivity and k', () => {
    const base = evaluate({ ...DEFAULT_PARAMS, current: 100 });
    const doubled = evaluate({ ...DEFAULT_PARAMS, current: 200 });
    expect(doubled.resistance).toBeCloseTo(base.resistance, 15);
    expect(doubled.loss / base.loss).toBeCloseTo(4, 12);
    expect(doubled.riseMax / base.riseMax).toBeCloseTo(4, 12);
    const aluminium = MATERIAL_PRESETS.find((item) => item.id === 'al-1060')!;
    // Same beta = h/k: rise scales with 1/(sigma k), resistance with 1/sigma.
    const scaled = evaluate({
      ...DEFAULT_PARAMS,
      sigma: aluminium.sigma,
      k: 200,
      h: (DEFAULT_PARAMS.h * 200) / DEFAULT_PARAMS.k,
    });
    expect(scaled.resistance / doubled.resistance).toBeCloseTo(
      DEFAULT_PARAMS.sigma / aluminium.sigma,
      12,
    );
    expect(scaled.riseMax / doubled.riseMax).toBeCloseTo(
      (DEFAULT_PARAMS.sigma * DEFAULT_PARAMS.k) / (aluminium.sigma * 200),
      10,
    );
    const hotter = evaluate({ ...DEFAULT_PARAMS, tSub: 90 });
    expect(hotter.tMax - doubled.tMax).toBeCloseTo(90 - DEFAULT_PARAMS.tSub, 12);
    expect(hotter.riseMax).toBeCloseTo(doubled.riseMax, 12);
  });

  it('sums the two conductors of the conducting path and leaves the third idle', () => {
    for (const state of ['sh', 'sl'] as const) {
      const result = evaluate({ ...DEFAULT_PARAMS, state });
      const active = ACTIVE_PATHS[state].map((item) => item.conductor);
      for (const id of CONDUCTOR_IDS)
        expect(result.conductors[id].active).toBe(active.includes(id));
      expect(result.resistance).toBeCloseTo(
        active.reduce((sum, id) => sum + result.conductors[id].resistance, 0),
        15,
      );
      expect(result.loss).toBeCloseTo(DEFAULT_PARAMS.current ** 2 * result.resistance, 12);
      expect(result.tMax).toBeCloseTo(
        DEFAULT_PARAMS.tSub + Math.max(...CONDUCTOR_IDS.map((id) => result.conductors[id].riseMax)),
        12,
      );
    }
  });

  it('rejects invalid inputs and recognizes material presets', () => {
    expect(() => validateParams({ ...DEFAULT_PARAMS, current: 401 })).toThrow(RangeError);
    expect(() => validateParams({ ...DEFAULT_PARAMS, h: Number.NaN })).toThrow(TypeError);
    expect(() => validateParams({ ...DEFAULT_PARAMS, state: 'pn' as 'sh' })).toThrow(TypeError);
    expect(materialOf(DEFAULT_PARAMS)).toBe('cu-c1020');
    expect(materialOf({ sigma: 35.4, k: 234 })).toBe('al-1060');
    expect(materialOf({ sigma: 40, k: 234 })).toBe('custom');
  });

  it('reproduces the committed FEM samples within the surrogate test limits', () => {
    const rows = readSamples();
    const nominal = rows.filter((row) => row.geometry === 'train-068');
    expect(nominal.length).toBe(16);
    for (const row of nominal) {
      const q = caseQuantities(
        SCALAR_MODEL,
        row.case as CaseKey,
        Number(row.thickness_mm),
        Number(row.strap_width_mm),
        Number(row.beta_per_m),
      );
      expect(Math.abs(q.resistanceG / Number(row.resistance_g_per_m) - 1)).toBeLessThan(0.01);
      expect(Math.abs(q.thetaMax / Number(row.theta_max) - 1)).toBeLessThan(0.02);
    }
    const test = rows.filter((row) => row.split === 'test');
    expect(test.length).toBe(SCALAR_MODEL.validation.testSamples * 4);
    const errors = test.map((row) => {
      const q = caseQuantities(
        SCALAR_MODEL,
        row.case as CaseKey,
        Number(row.thickness_mm),
        Number(row.strap_width_mm),
        Number(row.beta_per_m),
      );
      return Math.abs(q.thetaMax / Number(row.theta_max) - 1);
    });
    expect(errors.reduce((a, b) => a + b, 0) / errors.length).toBeLessThan(0.01);
    expect(Math.max(...errors)).toBeLessThan(0.05);
  });
});

describe('S2 validation records', () => {
  it('meets the analytic and convergence statements shown on the page', () => {
    const analytic = JSON.parse(
      readFileSync(path.join(fem, 'reports/analytic-validation.json'), 'utf8'),
    );
    expect(analytic.status).toBe('passed');
    expect(analytic.worst_relative_error).toBeLessThan(0.004);
    expect(
      analytic.cases.some((item: { check: string }) => item.check === 'straight-bar-resistance'),
    ).toBe(true);
    expect(
      analytic.cases.some((item: { check: string }) => item.check === '1d-conduction-joule-rise'),
    ).toBe(true);
    const convergence = JSON.parse(
      readFileSync(path.join(fem, 'reports/mesh-convergence.json'), 'utf8'),
    );
    expect(convergence.cases).toHaveLength(4);
    for (const item of convergence.cases) {
      expect(item.resistance.production_change_vs_finest).toBeLessThanOrEqual(0.005);
      expect(item.resistance.production_error_vs_reference).toBeLessThanOrEqual(0.015);
      for (const theta of item.theta_max)
        expect(theta.production_error_vs_reference).toBeLessThanOrEqual(0.012);
    }
    expect(busbarCopy.zh.validation).toContain('< 0.4%');
    expect(busbarCopy.zh.validation).toContain('≤ 1.5%');
    expect(busbarCopy.en.validation).toContain('within 0.4%');
    expect(busbarCopy.en.validation).toContain('1.5%');
  });
});

describe('S2 field model', () => {
  const field = JSON.parse(
    readFileSync(path.join(publicDir, 'field-model.json'), 'utf8'),
  ) as FieldModel;
  const bytes = readFileSync(path.join(publicDir, 'field-basis.f16'));
  const basis = decodeFloat16(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const evaluator = createFieldEvaluator(SCALAR_MODEL, field, basis);

  it('reconstructs lattice fields consistent with the scalar peak and geometry', () => {
    for (const state of ['sh', 'sl'] as const) {
      const params = { ...DEFAULT_PARAMS, state };
      const result = evaluate(params);
      const fields = evaluator(params, result);
      const geometry = createBusbarGeometry();
      for (const id of CONDUCTOR_IDS) {
        const value = fields[id];
        if (!result.conductors[id].active) {
          expect(value).toBeNull();
          continue;
        }
        const total = latticeOffsets(geometry.conductors[id]).at(-1)!;
        expect(value!.rise.length).toBe(total);
        const peak = Math.max(...value!.rise);
        expect(peak).toBeGreaterThan(0.9 * result.conductors[id].riseMax);
        expect(peak).toBeLessThan(1.05 * result.conductors[id].riseMax);
        expect(Math.max(...value!.currentDensity)).toBeGreaterThan(0);
      }
    }
  });

  it('decodes IEEE half precision', () => {
    const halves = new Uint16Array([0x3c00, 0xc000, 0x0000, 0x7bff, 0x0001]);
    expect(Array.from(decodeFloat16(halves.buffer))).toEqual([1, -2, 0, 65504, 2 ** -24]);
  });
});

describe('S2 display surfaces', () => {
  it('builds lattice faces, skips the bolt hole and truncates the section', () => {
    const geometry = createBusbarGeometry();
    const plate = geometry.conductors['p-layer'].boxes[0]!;
    const surface = buildBoxSurface(plate, 0)!;
    const [nx, ny, nz] = plate.lattice;
    expect(surface.positions.length / 3).toBe(
      2 * ((nx + 1) * (ny + 1) + (nx + 1) * (nz + 1) + (ny + 1) * (nz + 1)),
    );
    expect(surface.indices.length / 6).toBe(2 * (nx * ny + nx * nz + ny * nz));
    const upright = geometry.conductors['p-layer'].boxes.find((item) => item.hole)!;
    const withHole = buildBoxSurface(upright, 0)!;
    const [ux, uy, uz] = upright.lattice;
    expect(withHole.indices.length / 6).toBeLessThan(2 * (ux * uy + ux * uz + uy * uz));
    expect(buildBoxSurface(plate, 0, plate.min[2] - 1)).toBeNull();
    const post = geometry.conductors['p-layer'].boxes.find((item) => item.id === 'p-feed-post')!;
    const cut = buildBoxSurface(post, 0, (post.min[2] + post.max[2]) / 2)!;
    expect(
      Math.max(...Array.from(cut.positions).filter((_, index) => index % 3 === 1)),
    ).toBeCloseTo((post.min[2] + post.max[2]) / 2, 5);
  });
});

describe('S2 content', () => {
  it('describes the three conductors in both locales', () => {
    for (const locale of ['zh', 'en']) {
      const source = readFileSync(
        path.resolve(`src/content/lab/${locale}/busbar-joule-heating.md`),
        'utf8',
      );
      expect(source.match(/^ {2}- id: '([^']+)'/gm)?.map((line) => line.split("'")[1])).toEqual([
        ...CONDUCTOR_IDS,
      ]);
      for (const field of ['role', 'features', 'material'])
        expect(source.match(new RegExp(`^ {4}${field}: `, 'gm'))).toHaveLength(3);
    }
  });
});
