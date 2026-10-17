import { scheduleVisibleEnhancement } from '../_shared/visible-enhancement';
import { prefersStaticDisassembly } from '../_shared/disassembly/client';
import type { PinFinLocale } from './copy';
import type { PartId } from './geometry';
import {
  ARRANGEMENTS,
  COOLANTS,
  DEFAULT_PARAMS,
  definitionOf,
  NUMERIC_KEYS,
  PIN_MATERIALS,
  type GroupId,
  type NumericKey,
  type PinFinParams,
} from './parameters';
import type { Presenter } from './presenter';
import type { PinFinViewer, PinFinViewerDiagnostics } from './viewer';

interface PartView {
  id: PartId;
  name: string;
  secondaryName?: string;
  role: string;
  features: string;
  material: string;
}

type Snapshot = {
  instance: number;
  disposed: boolean;
  listenersAborted: boolean;
  pendingFrame: boolean;
  pendingLoad: boolean;
  renderer: string;
  viewer: PinFinViewerDiagnostics | null;
};

const numeric = new Set<string>(NUMERIC_KEYS);
const choices = {
  arrangement: ARRANGEMENTS as readonly string[],
  coolant: COOLANTS as readonly string[],
  material: PIN_MATERIALS as readonly string[],
};
const active = new Map<HTMLElement, { dispose(): void; snapshot(): Snapshot }>();
const released: Snapshot[] = [];
let initialized = 0;
let disposedCount = 0;
let registered = false;

export function getPinFinLifecycleSnapshot() {
  return {
    initialized,
    disposed: disposedCount,
    active: [...active.values()].map((entry) => entry.snapshot()),
    released: released.slice(),
  };
}

export function disposePinFinPages(): void {
  for (const entry of [...active.values()]) entry.dispose();
}

function initialize(root: HTMLElement): void {
  if (root.dataset.pfInitialized) return;
  root.dataset.pfInitialized = 'true';
  const locale: PinFinLocale = root.dataset.locale === 'en' ? 'en' : 'zh';
  const text = {
    loading: root.dataset.textLoading ?? '',
    manual: root.dataset.textManual ?? '',
    stage: root.dataset.textStage ?? '',
  };
  const query = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const all = <T extends Element>(selector: string) => [...root.querySelectorAll<T>(selector)];
  const canvas = query<HTMLElement>('[data-pf-canvas]');
  if (!canvas) return;
  const instance = ++initialized;
  const abort = new AbortController();
  const { signal } = abort;
  let parts: PartView[] = [];
  try {
    parts = JSON.parse(query('[data-pf-parts]')?.textContent ?? '[]') as PartView[];
  } catch {
    parts = [];
  }
  const state = {
    params: { ...DEFAULT_PARAMS } as PinFinParams,
    sweepKey: 'flow' as NumericKey,
    selected: 'pin-array' as PartId | null,
    cover: true,
  };
  let presenter: Presenter | null = null;
  let engine: Promise<Presenter> | null = null;
  let viewer: PinFinViewer | null = null;
  let requested = false;
  let pendingLoad = false;
  let disposed = false;
  let frame = 0;
  let cancelEnhancement: (() => void) | null = null;
  const observers: { disconnect(): void }[] = [];
  const setText = (selector: string, value: string) => {
    const element = query<HTMLElement>(selector);
    if (element && element.textContent !== value) element.textContent = value;
  };
  const inputs = all<HTMLInputElement>('[data-param]');
  const tabs = all<HTMLButtonElement>('[data-tab]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const device = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const staticMode = prefersStaticDisassembly({
    search: location.search,
    reducedMotion: reduced.matches,
    saveData: device.connection?.saveData,
    deviceMemory: device.deviceMemory,
    hardwareConcurrency: device.hardwareConcurrency,
  });
  const manualLoad = window.matchMedia('(pointer: coarse)').matches;
  const loadButton = query<HTMLButtonElement>('[data-pf-load]');

  function activateTab(id: GroupId, focus = false) {
    for (const tab of tabs) {
      const selected = tab.dataset.tab === id;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus({ preventScroll: true });
    }
    for (const panel of all<HTMLElement>('[data-panel]')) panel.hidden = panel.dataset.panel !== id;
  }

  function showPart(id: PartId | null) {
    state.selected = id;
    for (const button of all<HTMLButtonElement>('[data-select-part]'))
      button.setAttribute('aria-pressed', String(button.dataset.selectPart === id));
    const part = parts.find((entry) => entry.id === id);
    const card = query<HTMLElement>('#pf-part-card');
    if (card) card.hidden = !part;
    if (!part) return;
    setText('[data-part-name]', part.name);
    setText('[data-part-secondary]', part.secondaryName ?? '');
    setText('[data-part-role]', part.role);
    setText('[data-part-features]', part.features);
    setText('[data-part-material]', part.material);
  }

  function presentInputs() {
    for (const input of inputs) {
      const key = input.dataset.param as NumericKey;
      const definition = definitionOf(key);
      const value = state.params[key];
      if (input.valueAsNumber !== value) input.value = String(value);
      const position = (value - definition.min) / (definition.max - definition.min);
      input.style.setProperty('--range-fill', `${(position * 100).toFixed(2)}%`);
      input.setAttribute(
        'aria-valuetext',
        `${value.toFixed(definition.digits)} ${definition.unit}`,
      );
      setText(`[data-param-output="${key}"]`, value.toFixed(definition.digits));
    }
    for (const button of all<HTMLButtonElement>('[data-choice]')) {
      const key = button.dataset.choice as keyof typeof choices;
      button.setAttribute('aria-pressed', String(state.params[key] === button.dataset.value));
    }
    const select = query<HTMLSelectElement>('[data-sweep-key]');
    if (select && select.value !== state.sweepKey) select.value = state.sweepKey;
  }

  function ensureEngine(): Promise<Presenter> {
    engine ??= import('./presenter').then(({ createPresenter }) => {
      presenter = createPresenter(root, locale);
      return presenter;
    });
    return engine;
  }
  function recalculate() {
    frame = 0;
    if (disposed || !presenter) return;
    presentInputs();
    if (presenter.recalculate(state)) viewer?.update(state.params);
  }
  function queue() {
    presentInputs();
    void ensureEngine().then(() => {
      if (!frame && !disposed) frame = window.requestAnimationFrame(recalculate);
    });
  }

  for (const input of inputs)
    input.addEventListener(
      'input',
      () => {
        const key = input.dataset.param;
        if (!key || !numeric.has(key) || !Number.isFinite(input.valueAsNumber)) return;
        state.params[key as NumericKey] = input.valueAsNumber;
        state.sweepKey = key as NumericKey;
        queue();
      },
      { signal },
    );
  for (const button of all<HTMLButtonElement>('[data-choice]'))
    button.addEventListener(
      'click',
      () => {
        const key = button.dataset.choice as keyof typeof choices;
        const value = button.dataset.value ?? '';
        if (!(key in choices) || !choices[key].includes(value)) return;
        (state.params as unknown as Record<string, string>)[key] = value;
        queue();
      },
      { signal },
    );
  query<HTMLSelectElement>('[data-sweep-key]')?.addEventListener(
    'change',
    (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value;
      if (!numeric.has(value)) return;
      state.sweepKey = value as NumericKey;
      void ensureEngine().then((engine) => {
        if (!disposed) engine.chart(state);
      });
    },
    { signal },
  );
  query<HTMLButtonElement>('[data-reset-params]')?.addEventListener(
    'click',
    () => {
      state.params = { ...DEFAULT_PARAMS };
      state.sweepKey = 'flow';
      queue();
    },
    { signal },
  );
  for (const tab of tabs) {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab as GroupId), { signal });
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
        if (target) activateTab(target.dataset.tab as GroupId, true);
      },
      { signal },
    );
  }
  for (const button of all<HTMLButtonElement>('[data-select-part]'))
    button.addEventListener(
      'click',
      () => {
        const id = button.dataset.selectPart as PartId;
        showPart(id);
        viewer?.setSelected(id);
      },
      { signal },
    );
  query<HTMLButtonElement>('[data-cover]')?.addEventListener(
    'click',
    (event) => {
      state.cover = !state.cover;
      (event.currentTarget as HTMLElement).setAttribute('aria-pressed', String(state.cover));
      viewer?.setCover(state.cover);
    },
    { signal },
  );
  query<HTMLButtonElement>('[data-reset-view]')?.addEventListener('click', () => viewer?.reset(), {
    signal,
  });

  const chartSvg = query<SVGSVGElement>('[data-chart-svg]');
  chartSvg?.addEventListener(
    'pointermove',
    (event) => {
      if (presenter) presenter.hover(event, chartSvg);
      else void ensureEngine();
    },
    { signal },
  );
  chartSvg?.addEventListener('pointerleave', () => presenter?.hideHover(), { signal });

  // Pause the decorative stream animation while it is off-screen.
  const stream = query<SVGSVGElement>('[data-stream]');
  if (stream && 'IntersectionObserver' in window) {
    const streamObserver = new IntersectionObserver((entries) => {
      root.dataset.streamPaused = String(!entries.some((entry) => entry.isIntersecting));
    });
    streamObserver.observe(stream);
    observers.push(streamObserver);
  }

  function setRenderer(kind: 'static' | 'loading' | 'webgl') {
    canvas!.dataset.renderer = kind;
    root.dataset.renderer = kind;
  }
  function fallback() {
    cancelEnhancement?.();
    cancelEnhancement = null;
    if (loadButton) loadButton.hidden = true;
    const note = query<HTMLElement>('[data-fallback-note]');
    if (note) note.hidden = false;
    const hint = query<HTMLElement>('[data-interaction-hint]');
    if (hint) hint.hidden = true;
    setText('[data-load-status]', '');
    viewer?.dispose();
    viewer = null;
    setRenderer('static');
  }

  async function loadViewer() {
    if (requested || disposed || staticMode) return;
    requested = true;
    pendingLoad = true;
    cancelEnhancement?.();
    cancelEnhancement = null;
    if (loadButton) loadButton.hidden = true;
    setRenderer('loading');
    setText('[data-load-status]', text.loading);
    try {
      const { createPinFinViewer } = await import('./viewer');
      if (disposed) return;
      viewer = createPinFinViewer({
        container: canvas!,
        label: text.stage,
        onSelect: (id) => showPart(id),
        onError: () => fallback(),
      });
      viewer.update(state.params);
      viewer.setSelected(state.selected);
      viewer.setCover(state.cover);
      setRenderer('webgl');
      setText('[data-load-status]', '');
    } catch {
      if (!disposed) fallback();
    } finally {
      pendingLoad = false;
    }
  }

  // The server HTML already shows the default state; avoid DOM writes before first paint.
  // Only browser-restored form values (history navigation) need a recalculation.
  let restored = false;
  for (const input of inputs) {
    const key = input.dataset.param;
    if (key && numeric.has(key) && input.valueAsNumber !== state.params[key as NumericKey]) {
      state.params[key as NumericKey] = input.valueAsNumber;
      restored = true;
    }
  }
  if (restored) queue();
  if (staticMode) fallback();
  else if (manualLoad && loadButton) {
    root.dataset.load = 'manual';
    loadButton.hidden = false;
    setText('[data-load-status]', text.manual);
    loadButton.addEventListener(
      'click',
      () => {
        delete root.dataset.load;
        void loadViewer();
      },
      { signal },
    );
  } else {
    canvas.addEventListener('pointerdown', () => void loadViewer(), { signal });
    const schedule = () => {
      if (requested || cancelEnhancement || disposed) return;
      cancelEnhancement = scheduleVisibleEnhancement(
        () => {
          cancelEnhancement = null;
          void loadViewer();
        },
        { signal, preview: query<HTMLImageElement>('[data-pf-preview]') },
      );
    };
    if ('IntersectionObserver' in window) {
      const stageObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          stageObserver.disconnect();
          schedule();
        }
      });
      stageObserver.observe(canvas);
      observers.push(stageObserver);
    } else schedule();
  }
  reduced.addEventListener('change', () => reduced.matches && fallback(), { signal });

  // Load the calculation/presentation chunk once the page is idle after load, so chart hover
  // works without delaying first paint; any interaction loads it immediately.
  const prefetch = () => {
    if (disposed) return;
    const run = () => {
      if (!disposed && !engine)
        void ensureEngine().then((ready) => {
          if (disposed || frame) return;
          ready.stream(state.params);
          ready.chart(state);
        });
    };
    if (typeof window.requestIdleCallback === 'function')
      window.requestIdleCallback(run, { timeout: 4000 });
    else window.setTimeout(run, 1);
  };
  if (document.readyState === 'complete') prefetch();
  else window.addEventListener('load', prefetch, { once: true, signal });

  const snapshot = (): Snapshot => ({
    instance,
    disposed,
    listenersAborted: signal.aborted,
    pendingFrame: frame !== 0,
    pendingLoad: !disposed && pendingLoad,
    renderer: canvas.dataset.renderer ?? 'static',
    viewer: viewer?.getDiagnostics() ?? null,
  });
  active.set(root, {
    snapshot,
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      for (const observer of observers.splice(0)) observer.disconnect();
      cancelEnhancement?.();
      cancelEnhancement = null;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      presenter?.dispose();
      viewer?.dispose();
      active.delete(root);
      delete root.dataset.pfInitialized;
      disposedCount += 1;
      released.push(snapshot());
      if (released.length > 20) released.shift();
      viewer = null;
    },
  });
}

export function initializePinFinPages(): void {
  if (!registered) {
    registered = true;
    document.addEventListener('astro:before-swap', disposePinFinPages);
    document.addEventListener('astro:page-load', initializePinFinPages);
    window.addEventListener('pagehide', (event) => {
      if (!event.persisted) disposePinFinPages();
    });
    Object.defineProperty(window, 'pinFinLifecycle', {
      value: Object.freeze({ snapshot: getPinFinLifecycleSnapshot }),
      configurable: true,
    });
  }
  for (const root of document.querySelectorAll<HTMLElement>('[data-pin-fin-lab]')) initialize(root);
}
