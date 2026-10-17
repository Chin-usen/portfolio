import { pinLayout } from './layout';
import type { PinFinParams } from './parameters';

/**
 * Illustrative top-view streamlines: uniform flow plus superposed potential-flow doublets of
 * the nearest pins. This is a sketch for orientation only - not CFD, no wakes, no
 * separation, no end-wall or channel-wall effects.
 */
export interface StreamlineSketch {
  /** viewBox in mm: flow runs along +x (the footprint length). */
  viewBox: string;
  width: number;
  length: number;
  pins: string;
  lines: string[];
}

export function streamlineSketch(params: PinFinParams, lineCount = 9): StreamlineSketch {
  const layout = pinLayout(params);
  const r = params.diameter / 2;
  const st = params.pitchT * params.diameter;
  const sl = params.pitchL * params.diameter;
  const rows: { z: number; xs: number[] }[] = [];
  for (let i = 0; i < layout.count; i += 1) {
    const x = layout.centres[i * 2]!;
    const z = layout.centres[i * 2 + 1]!;
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.z - z) < 1e-9) last.xs.push(x);
    else rows.push({ z, xs: [x] });
  }
  const z0 = rows[0]?.z ?? 0;
  const r2 = r * r;
  function velocity(z: number, x: number): [number, number] {
    let u = 1;
    let v = 0;
    const j = Math.round((z - z0) / sl);
    for (let row = Math.max(0, j - 3); row <= Math.min(rows.length - 1, j + 3); row += 1) {
      const entry = rows[row]!;
      const first = entry.xs[0] ?? 0;
      const c = Math.round((x - first) / st);
      for (let col = Math.max(0, c - 3); col <= Math.min(entry.xs.length - 1, c + 3); col += 1) {
        const dz = z - entry.z;
        const dx = x - entry.xs[col]!;
        const d2 = dz * dz + dx * dx;
        if (d2 > 16 * st * st) continue;
        // w' = 1 − R²/ζ², ζ = dz + i dx → u − i v
        const inv = r2 / (d2 * d2);
        u -= inv * (dz * dz - dx * dx);
        v -= inv * 2 * dz * dx;
      }
    }
    return [u, v];
  }
  const nearestInside = (z: number, x: number): [number, number] => {
    const j = Math.round((z - z0) / sl);
    const entry = rows[Math.max(0, Math.min(rows.length - 1, j))];
    if (!entry) return [z, x];
    for (const cx of entry.xs) {
      const dz = z - entry.z;
      const dx = x - cx;
      const d = Math.hypot(dz, dx);
      if (d < r * 1.08) {
        const scale = (r * 1.1) / Math.max(d, 1e-6);
        return [entry.z + (d < 1e-6 ? -r * 1.1 : dz * scale), cx + (d < 1e-6 ? 0 : dx * scale)];
      }
    }
    return [z, x];
  };
  const ds = Math.max(0.12, params.diameter * 0.2);
  const lines: string[] = [];
  for (let line = 0; line < lineCount; line += 1) {
    let x = (params.width * (line + 0.5)) / lineCount;
    const firstRow = rows[0]?.xs ?? [];
    if (firstRow.some((cx) => Math.abs(cx - x) < r * 0.3)) x += r * 0.35;
    let z = -3;
    const points: string[] = [`${z.toFixed(2)} ${x.toFixed(2)}`];
    for (let step = 0; step < 4000 && z < params.length + 3; step += 1) {
      const [u1, v1] = velocity(z, x);
      const s1 = Math.hypot(u1, v1) || 1;
      const zm = z + (0.5 * ds * u1) / s1;
      const xm = x + (0.5 * ds * v1) / s1;
      const [u2, v2] = velocity(zm, xm);
      const s2 = Math.hypot(u2, v2) || 1;
      z += (ds * Math.max(0.2, u2)) / s2;
      x += (ds * v2) / s2;
      [z, x] = nearestInside(z, x);
      x = Math.min(params.width - 0.2, Math.max(0.2, x));
      if (step % 3 === 2) points.push(`${z.toFixed(1)} ${x.toFixed(1)}`);
    }
    lines.push('M' + points.join(' L'));
  }
  let pins = '';
  for (let i = 0; i < layout.count; i += 1) {
    const x = layout.centres[i * 2]!;
    const z = layout.centres[i * 2 + 1]!;
    pins += `M${(z - r).toFixed(2)} ${x.toFixed(2)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  }
  return {
    viewBox: `-4 -2 ${params.length + 8} ${params.width + 4}`,
    width: params.width,
    length: params.length,
    pins,
    lines,
  };
}
