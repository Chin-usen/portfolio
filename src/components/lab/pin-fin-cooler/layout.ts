import type { PinFinParams } from './parameters';

export interface PinLayout {
  /** Pin centres in millimetres: x across the flow (0…W), z along the flow (0…L). */
  centres: Float64Array;
  count: number;
  rows: number;
  /** Pins in a full (even) row. */
  perRow: number;
  /** Pins in an offset (odd) row; equals perRow for in-line arrays. */
  perOffsetRow: number;
}

/** Centred lattice inside the W × L footprint; staggered odd rows shift by S_T / 2. */
export function pinLayout(params: PinFinParams): PinLayout {
  const d = params.diameter;
  const st = params.pitchT * d;
  const sl = params.pitchL * d;
  const rows = Math.floor(params.length / sl + 1e-9);
  const perRow = Math.floor(params.width / st + 1e-9);
  const staggered = params.arrangement === 'staggered';
  const perOffsetRow = staggered ? Math.max(0, Math.floor(params.width / st - 0.5 + 1e-9)) : perRow;
  const extentX = staggered ? Math.max(perRow, perOffsetRow + 0.5) * st : perRow * st;
  const x0 = (params.width - extentX) / 2;
  const z0 = (params.length - rows * sl) / 2;
  const centres: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    const offset = staggered && row % 2 === 1;
    const count = offset ? perOffsetRow : perRow;
    for (let column = 0; column < count; column += 1)
      centres.push(x0 + (column + (offset ? 1 : 0.5)) * st, z0 + (row + 0.5) * sl);
  }
  return {
    centres: Float64Array.from(centres),
    count: centres.length / 2,
    rows,
    perRow,
    perOffsetRow,
  };
}
