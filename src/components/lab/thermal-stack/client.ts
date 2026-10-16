import { thermalCopy, type ThermalLocale, type ThermalTab } from './copy';
import { DEFAULT_PARAMS, PARAMETER_DEFINITIONS } from './parameters';
import { evaluate } from './evaluator';
import { createFallbackViewer } from './viewer-fallback';
import type { ParameterKey, ThermalLayerId, ThermalParams, ThermalResult } from './types';
import type { createThermalViewer, ThermalViewerDiagnostics } from './viewer';

type Viewer = ReturnType<typeof createThermalViewer>;
const layerTabs: Record<ThermalLayerId, ThermalTab> = {
  chip: 'operating',
  'solder-top': 'top-solder',
  'copper-top': 'amb',
  ceramic: 'amb',
  'copper-bottom': 'amb',
  'solder-bottom': 'bottom-solder',
  cooler: 'cooler',
};
const parameterKeys = new Set<string>(PARAMETER_DEFINITIONS.map(({ key }) => key));
const layerIds = new Set<string>(Object.keys(layerTabs));
const isLayer = (id: string | null): id is ThermalLayerId => id !== null && layerIds.has(id);

type StackSnapshot = {
  instance: number;
  disposed: boolean;
  calculationFrame: boolean;
  listenersAborted: boolean;
  observersConnected: boolean;
  viewer: ThermalViewerDiagnostics | null;
};
const activeStacks = new Map<HTMLElement, { dispose: () => void; snapshot: () => StackSnapshot }>();
const releasedStacks: StackSnapshot[] = [];
let initializedCount = 0;
let disposedCount = 0;
let lifecycleRegistered = false;

/** A bounded, value-only snapshot for route-lifecycle regression checks. */
export function getThermalLifecycleSnapshot() {
  return {
    initialized: initializedCount,
    disposed: disposedCount,
    active: [...activeStacks.values()].map((stack) => stack.snapshot()),
    released: releasedStacks.slice(),
  };
}

export function disposeThermalStacks(): void {
  for (const stack of [...activeStacks.values()]) stack.dispose();
}

function initialize(root: HTMLElement): void {
  if (root.dataset.thermalInitialized) return;
  root.dataset.thermalInitialized = 'true';
  const locale: ThermalLocale = root.dataset.locale === 'en' ? 'en' : 'zh';
  const copy = thermalCopy[locale];
  const query = <T extends Element>(selector: string): T | null => root.querySelector<T>(selector);
  const all = <T extends Element>(selector: string): T[] =>
    Array.from(root.querySelectorAll<T>(selector));
  const canvas = query<HTMLElement>('[data-thermal-canvas]');
  if (!canvas) return;
  const instance = ++initializedCount;
  const abort = new AbortController();
  const { signal } = abort;
  const inputs = all<HTMLInputElement>('[data-param]');
  const tabs = all<HTMLButtonElement>('[data-tab]');
  const materialButtons = all<HTMLButtonElement>('[data-material-key]');
  const selectionButtons = all<HTMLButtonElement>('[data-select-layer]');
  const state = {
    params: { ...DEFAULT_PARAMS } as ThermalParams,
    result: evaluate({ ...DEFAULT_PARAMS }),
    selected: 'chip' as ThermalLayerId | null,
    hovered: null as ThermalLayerId | null,
    cutaway: false,
    exploded: false,
  };
  let femEvaluator: ((params: ThermalParams) => ThermalResult) | undefined;
  let modelKind: 'analytic' | 'fem' = 'analytic';
  let modelLoading = false;
  let viewer: Viewer | null = null;
  let viewerRequested = false;
  let disposed = false;
  let frame = 0;
  let announceTimer = 0;
  let idle = 0;
  let idleTimeout = 0;
  let observer: IntersectionObserver | null = null;
  let fontsPending = false;

  const controlSummary = query<HTMLElement>('[data-control-summary]');
  const updateSummaryPosition = () => {
    if (controlSummary)
      controlSummary.dataset.static = String(
        controlSummary.getBoundingClientRect().height > window.innerHeight * 0.35,
      );
  };
  const summaryObserver =
    controlSummary && 'ResizeObserver' in window ? new ResizeObserver(updateSummaryPosition) : null;
  if (controlSummary) summaryObserver?.observe(controlSummary);
  window.addEventListener('resize', updateSummaryPosition, { signal });
  updateSummaryPosition();

  function setText(selector: string, value: string): void {
    const element = query<HTMLElement>(selector);
    if (element && element.textContent !== value) element.textContent = value;
  }

  function activateTab(id: ThermalTab, focus = false): void {
    for (const tab of tabs) {
      const selected = tab.dataset.tab === id;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) {
        if (focus) tab.focus({ preventScroll: true });
        const strip = tab.parentElement;
        if (strip) {
          const tabBox = tab.getBoundingClientRect();
          const stripBox = strip.getBoundingClientRect();
          const offset =
            tabBox.left < stripBox.left + 5
              ? tabBox.left - stripBox.left - 5
              : tabBox.right > stripBox.right - 5
                ? tabBox.right - stripBox.right + 5
                : 0;
          if (offset) strip.scrollLeft += offset;
        }
      }
    }
    for (const panel of all<HTMLElement>('[data-panel]')) panel.hidden = panel.dataset.panel !== id;
  }

  function showLayer(): void {
    const id = state.hovered ?? state.selected;
    const layer = state.result.layers.find((entry) => entry.id === id);
    const card = query<HTMLElement>('[data-layer-card]');
    if (!card) return;
    card.hidden = !layer;
    if (!layer) return;
    setText('[data-layer-name]', copy.layerNames[layer.id]);
    setText('[data-layer-thickness]', Number(layer.thickness.toFixed(3)).toString());
    setText('[data-layer-k]', Number(layer.k.toFixed(1)).toString());
    setText('[data-layer-drop]', (layer.tTop - layer.tBottom).toFixed(2));
    setText('[data-layer-fraction]', ((100 * layer.rth) / state.result.rthTotal).toFixed(1));
  }

  function selectLayer(id: ThermalLayerId | null): void {
    state.selected = id;
    state.hovered = null;
    viewer?.setSelected(id);
    if (id) activateTab(layerTabs[id]);
    for (const button of selectionButtons) {
      const selected = button.dataset.selectLayer === id;
      button.setAttribute('aria-pressed', String(selected));
    }
    showLayer();
  }

  function updateInputPresentation(): void {
    for (const input of inputs) {
      const key = input.dataset.param as ParameterKey;
      const value = state.params[key];
      input.value = String(value);
      const position = (value - Number(input.min)) / (Number(input.max) - Number(input.min));
      input.style.setProperty('--range-fill', `${position * 100}%`);
      input.setAttribute(
        'aria-valuetext',
        `${value} ${PARAMETER_DEFINITIONS.find((entry) => entry.key === key)?.unit ?? ''}`,
      );
      setText(`[data-param-output="${key}"]`, String(value));
    }
    for (const button of materialButtons) {
      const key = button.dataset.materialKey as ParameterKey;
      button.setAttribute(
        'aria-pressed',
        String(state.params[key] === Number(button.dataset.materialValue)),
      );
    }
  }

  function updateResultPresentation(result: ThermalResult): void {
    const fem = modelKind === 'fem';
    setText(
      '[data-source-node]',
      fem ? `${copy.femSource} ${result.tjAvg.toFixed(1)} °C` : copy.sourceNode,
    );
    setText('#thermal-resistance-title', fem ? copy.femResistanceTitle : copy.resistanceTitle);
    setText('[data-model-label]', fem ? copy.femLabel : copy.modelLabel);
    setText('[data-model-description]', fem ? copy.femDescription : copy.modelDescription);
    setText('[data-node-disclosure]', fem ? copy.femNodeDisclosure : copy.nodeDisclosure);
    setText('[data-field-disclosure]', fem ? copy.femFieldDisclosure : copy.fieldDisclosure);
    setText('[data-field-caption]', fem ? copy.femFieldCaption : copy.fieldCaption);
    setText('[data-validation]', fem ? copy.femValidation : copy.validation);
    setText('[data-value="tj"]', result.tjMax.toFixed(1));
    setText('[data-control-tj]', result.tjMax.toFixed(1));
    setText('[data-control-rth]', result.rthTotal.toFixed(3));
    setText('[data-control-model]', fem ? copy.modelFem : copy.modelAnalytic);
    const controlWarning = query<HTMLElement>('[data-control-warning]');
    if (controlWarning) controlWarning.hidden = result.tjMax <= 175;
    setText('[data-value="rth"]', result.rthTotal.toFixed(3));
    setText('[data-value="rth-total"]', result.rthTotal.toFixed(3));
    setText('[data-value="rise"]', (result.tjMax - state.params.T_cool).toFixed(1));
    setText('[data-value="min"]', result.tMin.toFixed(1));
    setText('[data-value="max"]', result.tMax.toFixed(1));
    const warning = query<HTMLElement>('[data-warning]');
    if (warning) warning.hidden = result.tjMax <= 175;
    const breakdown = [
      ...result.layers.map((layer) => ({
        id: layer.id,
        rth: layer.rth,
        name: copy.layerNames[layer.id],
      })),
      { id: 'convection', rth: result.rConv, name: copy.convection },
    ];
    for (const item of breakdown) {
      const fraction = item.rth / result.rthTotal;
      const segment = query<HTMLElement>(`[data-resistance-segment="${item.id}"]`);
      if (segment) {
        segment.style.flexGrow = String(fraction);
        segment.title = `${item.name}: ${(fraction * 100).toFixed(1)}% · ${item.rth.toFixed(4)} K/W`;
      }
      setText(`[data-fraction="${item.id}"]`, `${(fraction * 100).toFixed(1)}%`);
    }
    showLayer();
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      setText(
        '[data-result-live]',
        `${copy.currentResult}: ${copy.junction} ${result.tjMax.toFixed(1)} °C; ${copy.thermalResistance} ${result.rthTotal.toFixed(3)} K/W.${result.tjMax > 175 ? ` ${copy.warning}` : ''}`,
      );
    }, 250);
  }

  function recalculate(): void {
    frame = 0;
    if (disposed) return;
    const error = query<HTMLElement>('[data-input-error]');
    try {
      const next =
        modelKind === 'fem' && femEvaluator ? femEvaluator(state.params) : evaluate(state.params);
      state.result = next;
      if (error) error.hidden = true;
      updateInputPresentation();
      updateResultPresentation(next);
      viewer?.update(state.params, next);
    } catch {
      if (error) error.hidden = false;
    }
  }

  function queueCalculation(): void {
    if (!frame && !disposed) frame = window.requestAnimationFrame(recalculate);
  }

  for (const button of all<HTMLButtonElement>('[data-model]')) {
    button.addEventListener(
      'click',
      async () => {
        if (modelLoading || disposed) return;
        const requested = button.dataset.model === 'fem' ? 'fem' : 'analytic';
        const status = query<HTMLElement>('[data-model-status]');
        try {
          if (requested === 'fem' && !femEvaluator) {
            modelLoading = true;
            if (status) {
              status.hidden = false;
              status.textContent = copy.modelLoading;
            }
            const { loadFemEvaluator } = await import('./fem-adapter');
            femEvaluator = await loadFemEvaluator();
            if (disposed) return;
          }
          modelKind = requested;
          root.dataset.model = requested;
          if (status) status.hidden = true;
          for (const choice of all<HTMLButtonElement>('[data-model]'))
            choice.setAttribute('aria-pressed', String(choice.dataset.model === requested));
          queueCalculation();
        } catch {
          if (status) {
            status.hidden = false;
            status.textContent = copy.modelLoadFailure;
          }
        } finally {
          modelLoading = false;
        }
      },
      { signal },
    );
  }

  for (const input of inputs) {
    input.addEventListener(
      'input',
      () => {
        const key = input.dataset.param;
        if (!key || !parameterKeys.has(key)) return;
        const value = input.valueAsNumber;
        if (!Number.isFinite(value)) return;
        state.params[key as ParameterKey] = value;
        queueCalculation();
      },
      { signal },
    );
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab as ThermalTab), { signal });
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
        if (target) activateTab(target.dataset.tab as ThermalTab, true);
      },
      { signal },
    );
  }
  for (const button of materialButtons) {
    button.addEventListener(
      'click',
      () => {
        const key = button.dataset.materialKey;
        const value = Number(button.dataset.materialValue);
        if (!key || !parameterKeys.has(key) || !Number.isFinite(value)) return;
        state.params[key as ParameterKey] = value;
        queueCalculation();
      },
      { signal },
    );
  }
  for (const button of selectionButtons) {
    button.addEventListener(
      'click',
      () => {
        const id = button.dataset.selectLayer ?? null;
        if (id === 'convection') {
          selectLayer(null);
          activateTab('operating');
          for (const legend of selectionButtons)
            legend.setAttribute('aria-pressed', String(legend === button));
        } else if (isLayer(id)) selectLayer(state.selected === id ? null : id);
        void initializeViewer();
      },
      { signal },
    );
  }
  query<HTMLButtonElement>('[data-cutaway]')?.addEventListener(
    'click',
    (event) => {
      state.cutaway = !state.cutaway;
      (event.currentTarget as HTMLButtonElement).setAttribute(
        'aria-pressed',
        String(state.cutaway),
      );
      viewer?.setCutaway(state.cutaway);
      void initializeViewer();
    },
    { signal },
  );
  query<HTMLButtonElement>('[data-explode]')?.addEventListener(
    'click',
    (event) => {
      state.exploded = !state.exploded;
      (event.currentTarget as HTMLButtonElement).setAttribute(
        'aria-pressed',
        String(state.exploded),
      );
      viewer?.setExploded(state.exploded);
      void initializeViewer();
    },
    { signal },
  );
  query<HTMLButtonElement>('[data-reset-view]')?.addEventListener(
    'click',
    () => {
      viewer?.reset();
      state.cutaway = false;
      state.exploded = false;
      viewer?.setCutaway(false);
      viewer?.setExploded(false);
      query<HTMLButtonElement>('[data-cutaway]')?.setAttribute('aria-pressed', 'false');
      query<HTMLButtonElement>('[data-explode]')?.setAttribute('aria-pressed', 'false');
      selectLayer(null);
      void initializeViewer();
    },
    { signal },
  );
  query<HTMLButtonElement>('[data-reset-params]')?.addEventListener(
    'click',
    () => {
      state.params = { ...DEFAULT_PARAMS };
      queueCalculation();
    },
    { signal },
  );

  function showFallback(): void {
    const note = query<HTMLElement>('[data-fallback-note]');
    if (note) note.hidden = false;
    const hint = query<HTMLElement>('.thermal-interaction-hint');
    if (hint) hint.hidden = true;
  }

  async function initializeViewer(): Promise<void> {
    if (viewerRequested || disposed) return;
    viewerRequested = true;
    observer?.disconnect();
    if (idle) window.cancelIdleCallback?.(idle);
    if (idleTimeout) window.clearTimeout(idleTimeout);
    idle = 0;
    idleTimeout = 0;
    const options = {
      container: canvas!,
      labels: {
        stage: copy.stageLabel,
        fallbackStage: copy.fallbackStageLabel,
        layers: copy.layerNames,
        unavailable: copy.fallback,
        contextLost: copy.fallback,
      },
      onHover: (id: ThermalLayerId | null) => {
        state.hovered = isLayer(id) ? id : null;
        showLayer();
      },
      onSelect: (id: ThermalLayerId | null) => selectLayer(isLayer(id) ? id : null),
      onError: () => showFallback(),
    };
    try {
      if (new URLSearchParams(window.location.search).get('renderer') === '2d') {
        viewer = createFallbackViewer(options);
      } else {
        const { createThermalViewer: create } = await import('./viewer');
        if (disposed) return;
        viewer = create(options);
      }
    } catch {
      if (disposed) return;
      // A failed lazy WebGL chunk still leaves a fully interactive local 2D view.
      viewer = createFallbackViewer(options);
      showFallback();
    }
    query<HTMLElement>('[data-loading]')?.remove();
    viewer.update(state.params, state.result);
    viewer.setCutaway(state.cutaway);
    viewer.setExploded(state.exploded);
    viewer.setSelected(state.selected);
    if (canvas?.dataset.thermalRenderer === 'fallback') showFallback();
  }

  function scheduleViewer(): void {
    if (viewerRequested || idle || idleTimeout || fontsPending || disposed) return;
    fontsPending = true;
    // Readable measurements take network/CPU priority over the WebGL enhancement.
    // A pointer or keyboard interaction below can start the viewer immediately.
    void document.fonts.ready.then(() => {
      fontsPending = false;
      if (viewerRequested || disposed) return;
      if (typeof window.requestIdleCallback === 'function')
        idle = window.requestIdleCallback(() => {
          idle = 0;
          void initializeViewer();
        });
      else
        idleTimeout = window.setTimeout(() => {
          idleTimeout = 0;
          void initializeViewer();
        }, 0);
    });
  }
  canvas.addEventListener('pointerdown', () => void initializeViewer(), { signal });
  root.addEventListener(
    'focusin',
    (event) => {
      if ((event.target as HTMLElement).matches('button, input, canvas, [tabindex="0"]'))
        void initializeViewer();
    },
    { signal },
  );
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) scheduleViewer();
      },
      { rootMargin: '0px' },
    );
    observer.observe(canvas);
  } else scheduleViewer();

  updateInputPresentation();
  selectLayer(state.selected);
  const snapshot = (): StackSnapshot => ({
    instance,
    disposed,
    calculationFrame: frame !== 0,
    listenersAborted: signal.aborted,
    observersConnected: !disposed,
    viewer: viewer?.getDiagnostics() ?? null,
  });
  activeStacks.set(root, {
    snapshot,
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      observer?.disconnect();
      summaryObserver?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      if (idle) window.cancelIdleCallback?.(idle);
      if (idleTimeout) window.clearTimeout(idleTimeout);
      frame = 0;
      idle = 0;
      idleTimeout = 0;
      window.clearTimeout(announceTimer);
      viewer?.dispose();
      activeStacks.delete(root);
      delete root.dataset.thermalInitialized;
      disposedCount += 1;
      releasedStacks.push(snapshot());
      if (releasedStacks.length > 20) releasedStacks.shift();
      viewer = null;
    },
  });
}

export function initializeThermalStacks(): void {
  if (!lifecycleRegistered) {
    lifecycleRegistered = true;
    document.addEventListener('astro:before-swap', disposeThermalStacks);
    document.addEventListener('astro:page-load', initializeThermalStacks);
    window.addEventListener('pagehide', (event) => {
      if (!event.persisted) disposeThermalStacks();
    });
    Object.defineProperty(window, 'thermalStackLifecycle', {
      value: Object.freeze({ snapshot: getThermalLifecycleSnapshot }),
      configurable: true,
    });
  }
  for (const root of document.querySelectorAll<HTMLElement>('[data-thermal-lab]')) initialize(root);
}
