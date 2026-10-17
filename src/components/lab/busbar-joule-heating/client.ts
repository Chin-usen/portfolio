import { scheduleVisibleEnhancement } from '../_shared/visible-enhancement.ts';
import { busbarCopy, type BusbarLocale, type BusbarTab } from './copy.ts';
import { evaluate, SCALAR_MODEL } from './evaluator.ts';
import type { FieldEvaluator, FieldSet } from './field.ts';
import { CONDUCTOR_IDS, createBusbarGeometry, type ConductorId } from './geometry.ts';
import {
  DEFAULT_PARAMS,
  definition,
  MATERIAL_PRESETS,
  materialOf,
  PARAMETER_DEFINITIONS,
} from './parameters.ts';
import type { BusbarParams, BusbarResult, NumericKey, SwitchState } from './types.ts';
import { createFallbackViewer } from './viewer-fallback.ts';
import {
  fieldRange,
  type BusbarViewer,
  type BusbarViewerDiagnostics,
  type FieldMode,
  type Probe,
} from './viewer-shared.ts';

const numericKeys = new Set<string>(PARAMETER_DEFINITIONS.map(({ key }) => key));
const conductorIds = new Set<string>(CONDUCTOR_IDS);
const isConductor = (id: string | null | undefined): id is ConductorId =>
  !!id && conductorIds.has(id);

type Snapshot = {
  instance: number;
  disposed: boolean;
  calculationFrame: boolean;
  listenersAborted: boolean;
  enhancementPending: boolean;
  viewer: BusbarViewerDiagnostics | null;
};
const active = new Map<HTMLElement, { dispose: () => void; snapshot: () => Snapshot }>();
const released: Snapshot[] = [];
let initializedCount = 0;
let disposedCount = 0;
let lifecycleRegistered = false;

export function getBusbarLifecycleSnapshot() {
  return {
    initialized: initializedCount,
    disposed: disposedCount,
    active: [...active.values()].map((entry) => entry.snapshot()),
    released: released.slice(),
  };
}

export function disposeBusbarLabs(): void {
  for (const entry of [...active.values()]) entry.dispose();
}

/** Same weak-device policy as the shared disassembly controller. */
function staticPreferred(): boolean {
  const device = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    device.connection?.saveData === true ||
    (device.deviceMemory !== undefined && device.deviceMemory <= 2) ||
    (device.hardwareConcurrency > 0 && device.hardwareConcurrency <= 2)
  );
}

const format = (value: number, digits: number) => value.toFixed(digits).replace('-', '−');

function initialize(root: HTMLElement): void {
  if (root.dataset.busbarInitialized) return;
  root.dataset.busbarInitialized = 'true';
  const locale: BusbarLocale = root.dataset.locale === 'en' ? 'en' : 'zh';
  const copy = busbarCopy[locale];
  const query = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const all = <T extends Element>(selector: string) =>
    Array.from(root.querySelectorAll<T>(selector));
  const canvas = query<HTMLElement>('[data-busbar-canvas]');
  if (!canvas) return;
  const instance = ++initializedCount;
  const abort = new AbortController();
  const { signal } = abort;
  const inputs = all<HTMLInputElement>('[data-param]');
  const tabs = all<HTMLButtonElement>('[data-tab]');
  const poster = query<HTMLImageElement>('[data-busbar-poster]');
  const loadButton = query<HTMLButtonElement>('[data-busbar-load]');
  const names = Object.fromEntries(
    all<HTMLElement>('[data-conductor-name]').map((element) => [
      element.dataset.conductorName,
      element.textContent?.trim() ?? '',
    ]),
  ) as Record<ConductorId, string>;
  const state = {
    params: { ...DEFAULT_PARAMS } as BusbarParams,
    result: evaluate({ ...DEFAULT_PARAMS }),
    geometry: createBusbarGeometry({
      thicknessMm: DEFAULT_PARAMS.thickness,
      strapWidthMm: DEFAULT_PARAMS.strapWidth,
    }),
    fields: null as FieldSet | null,
    selected: 'ac-link' as ConductorId | null,
    hovered: null as ConductorId | null,
    probe: null as Probe | null,
    fieldMode: 'temperature' as FieldMode,
    cutaway: false,
    exploded: false,
  };
  let fieldEvaluator: FieldEvaluator | null = null;
  let viewer: BusbarViewer | null = null;
  let viewerRequested = false;
  let disposed = false;
  let frame = 0;
  let announceTimer = 0;
  let cancelEnhancement: (() => void) | null = null;
  let observer: IntersectionObserver | null = null;
  let awaitingTap = false;

  const setText = (selector: string, value: string) => {
    for (const element of all<HTMLElement>(selector))
      if (element.textContent !== value) element.textContent = value;
  };
  const controlSummary = query<HTMLElement>('[data-control-summary]');
  const updateSummaryPosition = () => {
    if (controlSummary)
      controlSummary.dataset.static = String(
        controlSummary.getBoundingClientRect().height > window.innerHeight * 0.35,
      );
  };
  window.addEventListener('resize', updateSummaryPosition, { signal });
  updateSummaryPosition();

  function activateTab(id: BusbarTab, focus = false): void {
    for (const tab of tabs) {
      const selected = tab.dataset.tab === id;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus({ preventScroll: true });
    }
    for (const panel of all<HTMLElement>('[data-panel]')) panel.hidden = panel.dataset.panel !== id;
  }

  function showConductor(): void {
    const id = state.hovered ?? state.selected;
    const card = query<HTMLElement>('[data-conductor-card]');
    if (!card) return;
    card.hidden = !id;
    if (!id) return;
    const item = state.result.conductors[id];
    setText('[data-card-name]', names[id] ?? id);
    setText('[data-card-state]', item.active ? copy.conducting : copy.idle);
    card.dataset.active = String(item.active);
    setText('[data-card-resistance]', format(item.resistance * 1e3, 4));
    setText('[data-card-loss]', format(item.loss, 2));
    setText('[data-card-peak]', format(state.params.tSub + item.riseMax, 1));
    const probe = state.hovered && state.probe ? state.probe : null;
    const probeRow = query<HTMLElement>('[data-card-probe]');
    if (probeRow) probeRow.hidden = !probe;
    if (probe)
      setText(
        '[data-card-probe-value]',
        `${format(probe.temperature, 1)} °C · ${format(probe.currentDensity, 1)} A/mm²`,
      );
    for (const role of all<HTMLElement>('[data-card-role]'))
      role.hidden = role.dataset.cardRole !== id;
  }

  function select(id: ConductorId | null): void {
    state.selected = id;
    state.hovered = null;
    viewer?.setSelected(id);
    for (const button of all<HTMLButtonElement>('[data-select-conductor]'))
      button.setAttribute('aria-pressed', String(button.dataset.selectConductor === id));
    root.dataset.selected = id ?? '';
    showConductor();
  }

  function updateInputs(): void {
    for (const input of inputs) {
      const key = input.dataset.param as NumericKey;
      const value = state.params[key];
      input.value = String(value);
      const position = (value - Number(input.min)) / (Number(input.max) - Number(input.min));
      input.style.setProperty('--range-fill', `${position * 100}%`);
      input.setAttribute('aria-valuetext', `${value} ${definition(key).unit}`);
      setText(`[data-param-output="${key}"]`, String(value));
    }
    const material = materialOf(state.params);
    for (const button of all<HTMLButtonElement>('[data-material]'))
      button.setAttribute('aria-pressed', String(button.dataset.material === material));
    for (const button of all<HTMLButtonElement>('[data-state]'))
      button.setAttribute('aria-pressed', String(button.dataset.state === state.params.state));
    root.dataset.state = state.params.state;
  }

  function updateScale(): void {
    const range = fieldRange(
      {
        params: state.params,
        result: state.result,
        geometry: state.geometry,
        fields: state.fields,
      },
      state.fieldMode,
    );
    const digits = state.fieldMode === 'temperature' ? 1 : 0;
    setText('[data-scale-min]', format(range.min, digits));
    setText('[data-scale-max]', format(range.max, digits));
    setText(
      '[data-scale-unit]',
      state.fieldMode === 'temperature' ? copy.temperatureUnit : copy.currentUnit,
    );
    setText(
      '[data-scale-title]',
      state.fieldMode === 'temperature' ? copy.fieldTemperature : copy.fieldCurrent,
    );
    setText(
      '[data-scale-caption]',
      state.fieldMode === 'temperature' ? copy.fieldCaption : copy.currentCaption,
    );
    root.dataset.field = state.fieldMode;
  }

  function updateResults(result: BusbarResult): void {
    setText('[data-value="tmax"]', format(result.tMax, 1));
    setText('[data-value="loss"]', format(result.loss, 2));
    setText('[data-value="resistance"]', format(result.resistance * 1e3, 3));
    setText('[data-value="rise"]', format(result.riseMax, 1));
    setText('[data-value="hotspot"]', names[result.hottest] ?? result.hottest);
    setText('[data-value="strap-j"]', format(result.strapCurrentDensity, 1));
    for (const warning of all<HTMLElement>('[data-warning]')) warning.hidden = result.riseMax <= 50;
    for (const id of CONDUCTOR_IDS) {
      const share = result.loss > 0 ? result.conductors[id].loss / result.loss : 0;
      const segment = query<HTMLElement>(`[data-loss-segment="${id}"]`);
      if (segment) {
        segment.style.flexGrow = String(share);
        segment.title = `${names[id]}: ${(share * 100).toFixed(1)}% · ${result.conductors[id].loss.toFixed(2)} W`;
      }
      setText(`[data-loss-share="${id}"]`, `${(share * 100).toFixed(1)}%`);
    }
    updateScale();
    showConductor();
    const poster = query<HTMLElement>('[data-poster-note]');
    if (poster) {
      const isDefault =
        PARAMETER_DEFINITIONS.every(({ key }) => state.params[key] === DEFAULT_PARAMS[key]) &&
        state.params.state === DEFAULT_PARAMS.state;
      poster.hidden = isDefault || viewerRequested;
    }
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      setText(
        '[data-result-live]',
        `${copy.currentResult}: ${copy.tMax} ${format(result.tMax, 1)} °C; ${copy.loss} ${format(result.loss, 2)} W; ${copy.resistance} ${format(result.resistance * 1e3, 3)} mΩ.${result.riseMax > 50 ? ` ${copy.warning}` : ''}`,
      );
    }, 250);
  }

  function pushToViewer(): void {
    viewer?.update({
      params: state.params,
      result: state.result,
      geometry: state.geometry,
      fields: state.fields,
    });
  }

  function recalculate(): void {
    frame = 0;
    if (disposed) return;
    const error = query<HTMLElement>('[data-input-error]');
    try {
      const next = evaluate(state.params);
      state.result = next;
      const geometryInput = {
        thicknessMm: state.params.thickness,
        strapWidthMm: state.params.strapWidth,
      };
      if (
        state.geometry.input.thicknessMm !== geometryInput.thicknessMm ||
        state.geometry.input.strapWidthMm !== geometryInput.strapWidthMm
      )
        state.geometry = createBusbarGeometry(geometryInput);
      state.fields = fieldEvaluator ? fieldEvaluator(state.params, next) : null;
      if (error) error.hidden = true;
      updateInputs();
      updateResults(next);
      pushToViewer();
    } catch {
      if (error) error.hidden = false;
    }
  }
  const queue = () => {
    if (!frame && !disposed) frame = window.requestAnimationFrame(recalculate);
  };

  for (const input of inputs) {
    input.addEventListener(
      'input',
      () => {
        const key = input.dataset.param;
        const value = input.valueAsNumber;
        if (!key || !numericKeys.has(key) || !Number.isFinite(value)) return;
        state.params[key as NumericKey] = value;
        queue();
      },
      { signal },
    );
  }
  for (const button of all<HTMLButtonElement>('[data-state]')) {
    button.addEventListener(
      'click',
      () => {
        const value = button.dataset.state as SwitchState;
        if (value !== 'sh' && value !== 'sl') return;
        state.params.state = value;
        queue();
      },
      { signal },
    );
  }
  for (const button of all<HTMLButtonElement>('[data-material]')) {
    button.addEventListener(
      'click',
      () => {
        const preset = MATERIAL_PRESETS.find((entry) => entry.id === button.dataset.material);
        if (preset) {
          state.params.sigma = preset.sigma;
          state.params.k = preset.k;
          queue();
        } else query<HTMLInputElement>('[data-param="sigma"]')?.focus();
      },
      { signal },
    );
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab as BusbarTab), { signal });
    tab.addEventListener(
      'keydown',
      (event) => {
        const index = tabs.indexOf(tab);
        let next: number;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        const target = tabs[next];
        if (target) activateTab(target.dataset.tab as BusbarTab, true);
      },
      { signal },
    );
  }
  for (const button of all<HTMLButtonElement>('[data-select-conductor]')) {
    button.addEventListener(
      'click',
      () => {
        const id = button.dataset.selectConductor;
        if (isConductor(id)) select(state.selected === id ? null : id);
      },
      { signal },
    );
  }
  for (const button of all<HTMLButtonElement>('[data-field]')) {
    button.addEventListener(
      'click',
      () => {
        state.fieldMode = button.dataset.field === 'current' ? 'current' : 'temperature';
        for (const choice of all<HTMLButtonElement>('[data-field]'))
          choice.setAttribute('aria-pressed', String(choice === button));
        viewer?.setFieldMode(state.fieldMode);
        updateScale();
      },
      { signal },
    );
  }
  // Topology symbols are SVG groups with role="button"; give them native button keys.
  for (const element of all<SVGElement>('svg [role="button"]')) {
    element.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      },
      { signal },
    );
  }
  const toggle = (selector: string, key: 'cutaway' | 'exploded', apply: (value: boolean) => void) =>
    query<HTMLButtonElement>(selector)?.addEventListener(
      'click',
      (event) => {
        state[key] = !state[key];
        (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(state[key]));
        apply(state[key]);
        void initializeViewer();
      },
      { signal },
    );
  toggle('[data-cutaway]', 'cutaway', (value) => viewer?.setCutaway(value));
  toggle('[data-explode]', 'exploded', (value) => viewer?.setExploded(value));
  query<HTMLButtonElement>('[data-reset-view]')?.addEventListener(
    'click',
    () => {
      state.cutaway = false;
      state.exploded = false;
      viewer?.setCutaway(false);
      viewer?.setExploded(false);
      viewer?.reset();
      query<HTMLButtonElement>('[data-cutaway]')?.setAttribute('aria-pressed', 'false');
      query<HTMLButtonElement>('[data-explode]')?.setAttribute('aria-pressed', 'false');
      select(null);
      void initializeViewer();
    },
    { signal },
  );
  query<HTMLButtonElement>('[data-reset-params]')?.addEventListener(
    'click',
    () => {
      state.params = { ...DEFAULT_PARAMS };
      queue();
    },
    { signal },
  );

  function showFallbackNote(): void {
    const note = query<HTMLElement>('[data-fallback-note]');
    if (note) note.hidden = false;
    for (const element of all<HTMLElement>('[data-webgl-only]')) element.hidden = true;
  }

  async function loadFields(): Promise<void> {
    if (fieldEvaluator) return;
    const status = query<HTMLElement>('[data-field-status]');
    if (status) {
      status.hidden = false;
      status.textContent = copy.fieldLoading;
    }
    try {
      const { loadFieldEvaluator } = await import('./field.ts');
      const evaluator = await loadFieldEvaluator(SCALAR_MODEL);
      if (disposed) return;
      fieldEvaluator = evaluator;
      if (status) status.hidden = true;
      queue();
    } catch {
      if (status) status.textContent = copy.fieldFailure;
    }
  }

  async function initializeViewer(): Promise<void> {
    if (viewerRequested || disposed) return;
    viewerRequested = true;
    awaitingTap = false;
    observer?.disconnect();
    cancelEnhancement?.();
    cancelEnhancement = null;
    if (loadButton) loadButton.hidden = true;
    delete root.dataset.load;
    void loadFields();
    const options = {
      container: canvas!,
      labels: {
        stage: copy.stageLabel,
        fallbackStage: copy.fallbackStageLabel,
        conductors: names,
        context: copy.contextLabel,
        idle: copy.idle,
      },
      onHover: (id: ConductorId | null, probe: Probe | null) => {
        state.hovered = isConductor(id) ? id : null;
        state.probe = probe;
        showConductor();
      },
      onSelect: (id: ConductorId | null) => select(isConductor(id) ? id : null),
      onError: () => showFallbackNote(),
    };
    const preferStatic =
      new URLSearchParams(window.location.search).get('renderer') === '2d' || staticPreferred();
    try {
      if (preferStatic) viewer = createFallbackViewer(options);
      else {
        const { createBusbarViewer } = await import('./viewer.ts');
        if (disposed) return;
        viewer = createBusbarViewer(options);
      }
    } catch {
      if (disposed) return;
      viewer = createFallbackViewer(options);
    }
    if (disposed) {
      viewer.dispose();
      return;
    }
    root.dataset.renderer = canvas!.dataset.busbarRenderer ?? 'fallback';
    if (root.dataset.renderer === 'fallback') showFallbackNote();
    query<HTMLElement>('[data-loading]')?.remove();
    if (poster) poster.hidden = true;
    const note = query<HTMLElement>('[data-poster-note]');
    if (note) note.hidden = true;
    viewer.setFieldMode(state.fieldMode);
    viewer.setCutaway(state.cutaway);
    viewer.setExploded(state.exploded);
    viewer.setSelected(state.selected);
    pushToViewer();
  }

  function scheduleViewer(): void {
    if (viewerRequested || cancelEnhancement || disposed || awaitingTap) return;
    cancelEnhancement = scheduleVisibleEnhancement(
      () => {
        cancelEnhancement = null;
        void initializeViewer();
      },
      { signal, preview: poster },
    );
  }

  // Touch devices keep the static preview until the visitor asks for WebGL.
  // Touch devices (including weak ones, which then get the 2D plan view) wait for a tap.
  const manualLoad = Boolean(loadButton) && window.matchMedia('(pointer: coarse)').matches;
  if (manualLoad && loadButton && staticPreferred()) loadButton.textContent = copy.loadPlan;
  canvas.addEventListener(
    'pointerdown',
    () => {
      if (!awaitingTap) void initializeViewer();
    },
    { signal },
  );
  loadButton?.addEventListener('click', () => void initializeViewer(), { signal });
  root.addEventListener(
    'focusin',
    (event) => {
      if (awaitingTap) return;
      if ((event.target as HTMLElement).matches('button, input, canvas, [tabindex="0"]'))
        void initializeViewer();
    },
    { signal },
  );
  if (manualLoad && loadButton) {
    awaitingTap = true;
    root.dataset.load = 'manual';
    loadButton.hidden = false;
    root.dataset.renderer = 'poster';
  } else if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) scheduleViewer();
    });
    observer.observe(canvas);
  } else scheduleViewer();

  updateInputs();
  updateResults(state.result);
  select(state.selected);
  const snapshot = (): Snapshot => ({
    instance,
    disposed,
    calculationFrame: frame !== 0,
    listenersAborted: signal.aborted,
    enhancementPending: cancelEnhancement !== null,
    viewer: viewer?.getDiagnostics() ?? null,
  });
  active.set(root, {
    snapshot,
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      cancelEnhancement?.();
      cancelEnhancement = null;
      window.clearTimeout(announceTimer);
      viewer?.dispose();
      active.delete(root);
      delete root.dataset.busbarInitialized;
      disposedCount += 1;
      released.push(snapshot());
      if (released.length > 20) released.shift();
      viewer = null;
    },
  });
}

export function initializeBusbarLabs(): void {
  if (!lifecycleRegistered) {
    lifecycleRegistered = true;
    document.addEventListener('astro:before-swap', disposeBusbarLabs);
    document.addEventListener('astro:page-load', initializeBusbarLabs);
    window.addEventListener('pagehide', (event) => {
      if (!event.persisted) disposeBusbarLabs();
    });
    Object.defineProperty(window, 'busbarLabLifecycle', {
      value: Object.freeze({ snapshot: getBusbarLifecycleSnapshot }),
      configurable: true,
    });
  }
  for (const root of document.querySelectorAll<HTMLElement>('[data-busbar-lab]')) initialize(root);
}
