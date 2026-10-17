export const PART_IDS = [
  'housing',
  'dc-terminal',
  'ac-terminal',
  'busbar',
  'signal-pin',
  'gate-wire',
  'mosfet',
  'amb',
  'solder',
  'baseplate',
] as const;
export type PartId = (typeof PART_IDS)[number];
export type BridgeMode = 'assembled' | 'exploded' | 'commutation';
export type BridgeLocale = 'zh' | 'en';
export type InductanceParams = { d: number; w: number; l: number };
export type PartContent = {
  partId: PartId;
  nameZh: string;
  nameEn: string;
  shortZh: string;
  shortEn: string;
  roleZh: string;
  roleEn: string;
  featuresZh: string;
  featuresEn: string;
  materialZh: string;
  materialEn: string;
  order: number;
};
export type ModelPart = {
  name: string;
  partId: PartId;
  circuitNode?: string;
  explodeZmm: number;
  gapMotion?: number;
  gapScale?: boolean;
  boundsMm?: [number[], number[]];
};
export type ModelManifest = {
  version: number;
  units: string;
  upAxis: string;
  parts: ModelPart[];
  parameters: { busbarGapMm: number };
};
export type BridgeViewerDiagnostics = {
  mode: 'webgl';
  disposed: boolean;
  loaded: boolean;
  scheduledFrame: boolean;
  ownedListeners: number;
  controlsDisposed: boolean;
  geometryCount: number;
  meshCount: number;
  selectedId: PartId;
  presentation: BridgeMode;
  explodeProgress: number;
  gapMm: number;
  gapDisplayScale: number;
  sourceCollectorContacts: readonly {
    readonly clipName: string;
    /** Signed surface separation at the clip centre, in mm; null if either surface is absent. */
    readonly gapMm: number | null;
  }[];
  sourceCollectorBounds: Readonly<{
    bottomYmm: number;
    topYmm: number;
    nPlateTopYmm: number | null;
  }> | null;
  rendererInfo: { geometries: number; textures: number; programs: number; contextLost: boolean };
};
export type ProjectedAnchor = { id: PartId; x: number; y: number; visible: boolean };
