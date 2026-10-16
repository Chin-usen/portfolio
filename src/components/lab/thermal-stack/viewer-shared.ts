import type { ThermalLayer, ThermalLayerId, ThermalParams, ThermalResult } from './types';

export interface ThermalViewerOptions {
  container: HTMLElement;
  labels?: {
    stage?: string;
    fallbackStage?: string;
    layers?: Partial<Record<ThermalLayerId, string>>;
    unavailable?: string;
    contextLost?: string;
  };
  onHover?: (id: ThermalLayerId | null) => void;
  onSelect?: (id: ThermalLayerId | null) => void;
  onError?: (message: string) => void;
}

export interface ThermalViewerDiagnostics {
  mode: 'webgl' | 'fallback';
  renderCount: number;
  scheduledFrame: boolean;
  layerCount: number;
  geometryCount: number;
  vertexCount: number;
  selectedId: ThermalLayerId | null;
  hoveredId: ThermalLayerId | null;
  cutaway: boolean;
  exploded: boolean;
  explodeProgress: number;
  lastUpdateMs: number;
  pixelRatio: number;
  disposed: boolean;
  /** Actual Three.js allocation counters; absent in the SVG fallback. */
  rendererInfo?: {
    geometries: number;
    textures: number;
    programs: number;
    drawCalls: number;
    triangles: number;
    contextLost: boolean;
  };
  ownedListeners?: number;
  controlsDisposed?: boolean;
}

export interface ThermalViewer {
  update(params: ThermalParams, result: ThermalResult): void;
  setCutaway(enabled: boolean): void;
  setExploded(enabled: boolean): void;
  setSelected(id: ThermalLayerId | null): void;
  reset(): void;
  dispose(): void;
  getDiagnostics(): ThermalViewerDiagnostics;
}

export interface DisplayLayer {
  layer: ThermalLayer;
  height: number;
  center: number;
  explodeOffset: number;
}

/** Display-only thickness expansion: source physics always retain actual millimetres. */
export function layoutLayers(layers: readonly ThermalLayer[]): DisplayLayer[] {
  const bottomUp = [...layers].reverse();
  const heights = bottomUp.map((layer) => Math.max(0.65, Math.sqrt(layer.thickness) * 1.65));
  const total = heights.reduce((sum, height) => sum + height, 0);
  let base = -total / 2;
  return bottomUp.map((layer, index) => {
    const height = heights[index] ?? 0.65;
    const center = base + height / 2;
    base += height;
    return {
      layer,
      height,
      center,
      explodeOffset: (index - (layers.length - 1) / 2) * 1.55,
    };
  });
}

export const THERMAL_PALETTE = ['#16123A', '#5B1F6B', '#D63A4F', '#FF8A3D', '#FFEEAA'] as const;

/** A shared lookup preserves the same temperature legend in WebGL and 2D. */
const stops = THERMAL_PALETTE.map((hex) => [
  Number.parseInt(hex.slice(1, 3), 16) / 255,
  Number.parseInt(hex.slice(3, 5), 16) / 255,
  Number.parseInt(hex.slice(5, 7), 16) / 255,
]);
export const LINEAR_PALETTE = new Float32Array(256 * 3);
export const CSS_PALETTE: string[] = [];
for (let index = 0; index < 256; index += 1) {
  const t = (index / 255) * (stops.length - 1);
  const low = Math.min(stops.length - 2, Math.floor(t));
  const amount = t - low;
  const a = stops[low]!;
  const b = stops[low + 1]!;
  const srgb = a.map((channel, axis) => channel + ((b[axis] ?? channel) - channel) * amount);
  for (let axis = 0; axis < 3; axis += 1) {
    const value = srgb[axis] ?? 0;
    LINEAR_PALETTE[index * 3 + axis] =
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }
  CSS_PALETTE.push(`rgb(${srgb.map((channel) => Math.round(channel * 255)).join(' ')})`);
}

export function paletteIndex(temperature: number, result: ThermalResult): number {
  const range = result.tMax - result.tMin;
  const value = range > 1e-9 ? (temperature - result.tMin) / range : 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

export function easedProgress(start: number, from: number, to: number, now: number): number {
  const t = Math.min(1, Math.max(0, (now - start) / 400));
  const eased = t * t * (3 - 2 * t);
  return from + (to - from) * eased;
}
