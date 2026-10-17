export type PartView<Id extends string = string> = {
  id: Id;
  name: string;
  secondaryName?: string;
  short: string;
  role: string;
  features: string;
  material: string;
};
export type DisassemblyMode<Mode extends string = string> = {
  id: Mode;
  label: string;
  caption: string;
  showLabels?: boolean;
};
export type DisassemblyCopy = {
  kicker: string;
  title: string;
  subtitle: string;
  back: string;
  stage: string;
  modes: string;
  reset: string;
  hint: string;
  loading: string;
  keyboard: string;
  parts: string;
  selected: string;
  role: string;
  features: string;
  material: string;
  noJs: string;
  allParts: string;
  /** Shared labels supplied by DisassemblyPage for touch-device on-demand loading. */
  load3d?: string;
  manualLoad?: string;
};
export type DisassemblyDefinition = {
  copy: DisassemblyCopy;
  parts: readonly PartView[];
  modes: readonly DisassemblyMode[];
  defaultPartId: string;
  defaultMode: string;
  idPrefix: string;
  poster: {
    src: string;
    srcset?: string;
    sizes?: string;
    width: number;
    height: number;
    alt: string;
  };
};
export type ProjectedAnchor<Id extends string = string> = {
  id: Id;
  x: number;
  y: number;
  visible: boolean;
};
export type DisassemblyViewer<Id extends string = string, Mode extends string = string> = {
  setSelected(id: Id): void;
  setMode(mode: Mode): void;
  reset(): void;
  dispose(): void;
  getDiagnostics(): unknown;
};
export type ViewerOptions<Id extends string> = {
  container: HTMLElement;
  label: string;
  keyboardDescriptionId: string;
  onSelect(id: Id): void;
  onProject(anchors: ProjectedAnchor<Id>[]): void;
  onReady(): void;
  onError(): void;
};
export type ControllerSnapshot<Diagnostics = unknown> = {
  instance: number;
  disposed: boolean;
  listenersAborted: boolean;
  observersConnected: boolean;
  pendingLoad: boolean;
  viewer: Diagnostics | null;
};
export type RootController<Diagnostics = unknown> = {
  snapshot(): ControllerSnapshot<Diagnostics>;
  dispose(): void;
};
export type AddonContext<Id extends string, Mode extends string, Viewer> = {
  root: HTMLElement;
  signal: AbortSignal;
  reduced: MediaQueryList;
  readonly viewer: Viewer | null;
  readonly mode: Mode;
  readonly selected: Id;
  readonly disposed: boolean;
  query<T extends Element>(selector: string): T | null;
  all<T extends Element>(selector: string): T[];
  setText(selector: string, text: string): void;
  select(id: Id): void;
  setMode(mode: Mode): void;
  present(): void;
};
export type DisassemblyAddon<Viewer> = {
  onMode?(): void;
  onPresentation?(): void;
  onViewer?(viewer: Viewer): void;
  onReducedMotion?(): void;
  dispose?(): void;
};
export type ControllerOptions<
  Id extends string,
  Mode extends string,
  Viewer extends DisassemblyViewer<Id, Mode>,
> = {
  parts: readonly PartView<Id>[];
  modes: readonly DisassemblyMode<Mode>[];
  defaultPartId: Id;
  defaultMode: Mode;
  keyboardDescriptionId: string;
  copy: {
    stage: string;
    staticMode: string;
    fallback: string;
    loadFailure: string;
    fallbackReason: string;
  };
  loadViewer(): Promise<(options: ViewerOptions<Id>) => Viewer>;
  mountAddon?(context: AddonContext<Id, Mode, Viewer>): DisassemblyAddon<Viewer>;
};
