import { scheduleVisibleEnhancement } from '../_shared/visible-enhancement';
import { prefersStaticDisassembly } from '../_shared/disassembly/client';
import { CHART, chartModel, type ChartModel } from './chart';
import { pinFinCopy, type PinFinLocale } from './copy';
import { evaluate, type PinFinResult } from './evaluator';
import { details, formatCheckValue, formatRange, headline } from './format';
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
import { streamlineSketch } from './streamlines';
import { sweep } from './sweep';
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
const SVG = 'http://www.w3.org/2000/svg';
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

function svg<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number>,
  text?: string,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function initialize(root: HTMLElement): void {
  if (root.dataset.pfInitialized) return;
  root.dataset.pfInitialized = 'true';
  const locale: PinFinLocale = root.dataset.locale === 'en' ? 'en' : 'zh';
  const copy = pinFinCopy[locale];
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
  let chart: ChartModel | null = null;
  let viewer: PinFinViewer | null = null;
  let requested = false;
  let pendingLoad = false;
  let disposed = false;
  let frame = 0;
  let announceTimer = 0;
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

  function presentValidity(next: PinFinResult) {
    for (const check of next.checks) {
      const row = query<HTMLElement>(`[data-check="${check.id}"]`);
      if (!row) continue;
      row.dataset.status = check.status;
      const value = row.querySelector('[data-check-value]');
      const range = row.querySelector('[data-check-range]');
      const status = row.querySelector('[data-check-status]');
      if (value) value.textContent = formatCheckValue(check);
      if (range) range.textContent = formatRange(check);
      if (status) status.textContent = copy.statusNames[check.status];
    }
    for (const list of all<HTMLUListElement>('[data-explain-list]')) {
      const items = next.checks.filter(
        (check) => check.correlation === list.dataset.explainList && check.status !== 'ok',
      );
      list.replaceChildren(
        ...items.map((check) => {
          const item = document.createElement('li');
          item.dataset.status = check.status;
          item.textContent = copy.validity[check.id].explain;
          return item;
        }),
      );
    }
    const kind = next.outCount > 0 ? 'out' : next.cautionCount > 0 ? 'caution' : 'ok';
    const message =
      next.outCount > 0
        ? `${next.outCount} ${copy.statusOut}`
        : next.cautionCount > 0
          ? `${next.cautionCount} ${copy.statusCaution}`
          : copy.statusAllOk;
    root.dataset.status = kind;
    const line = query<HTMLElement>('[data-status-line]');
    if (line) line.dataset.kind = kind;
    setText('[data-status-icon]', kind === 'ok' ? '✓' : '!');
    setText('[data-status-text]', message);
    const control = query<HTMLElement>('[data-control-status]');
    if (control) control.dataset.kind = kind;
    setText('[data-control-status]', message);
    return message;
  }

  function presentChart() {
    const data = sweep(state.params, state.sweepKey);
    chart = chartModel(data);
    const svgRoot = query<SVGSVGElement>('[data-chart-svg]');
    const grid = query<SVGGElement>('[data-chart-grid]');
    if (!svgRoot || !grid) return;
    grid.replaceChildren(
      ...chart.yTicks.map((tick) => {
        const group = svg('g', {});
        group.append(
          svg('line', {
            x1: CHART.left,
            x2: CHART.width - CHART.right,
            y1: tick.position,
            y2: tick.position,
          }),
          svg(
            'text',
            { x: CHART.left - 8, y: tick.position, dy: '0.32em', 'text-anchor': 'end' },
            tick.label,
          ),
        );
        return group;
      }),
      ...chart.xTicks.map((tick) => {
        const group = svg('g', {});
        group.append(
          svg('line', {
            x1: tick.position,
            x2: tick.position,
            y1: CHART.top,
            y2: CHART.height - CHART.bottom,
          }),
          svg(
            'text',
            { x: tick.position, y: CHART.height - CHART.bottom + 18, 'text-anchor': 'middle' },
            tick.label,
          ),
        );
        return group;
      }),
    );
    query('[data-chart-line]')?.setAttribute('d', chart.path);
    query('[data-chart-marks]')?.replaceChildren(
      ...chart.marks.map((mark) =>
        svg('circle', {
          class: mark.out ? 'pf-chart-mark out' : 'pf-chart-mark',
          cx: mark.x,
          cy: mark.y,
          r: 4,
        }),
      ),
    );
    let current = query<SVGCircleElement>('[data-chart-current]');
    if (!current) {
      current = svg('circle', { class: 'pf-chart-current', 'data-chart-current': '', r: 7 });
      query('[data-chart-marks]')?.after(current);
    }
    current.setAttribute('cx', String(chart.current?.x ?? -20));
    current.setAttribute('cy', String(chart.current?.y ?? -20));
    const definition = definitionOf(state.sweepKey);
    const label = copy.parameterLabels[state.sweepKey];
    setText('[data-chart-table-key]', `${label} (${definition.unit})`);
    query('[data-chart-table-body]')?.replaceChildren(
      ...chart.marks.map((mark) => {
        const row = document.createElement('tr');
        if (mark.out) row.className = 'out';
        for (const value of [
          String(Number(mark.value.toFixed(3))),
          mark.rth.toPrecision(3),
          mark.dpKpa.toPrecision(3),
        ]) {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.append(cell);
        }
        return row;
      }),
    );
    hideHover();
  }

  function readout(mark: ChartModel['marks'][number] | null, prefix: string) {
    const element = query<HTMLElement>('[data-chart-readout]');
    if (!element || !mark) return;
    const definition = definitionOf(state.sweepKey);
    element.textContent = `${prefix}: ${copy.parameterLabels[state.sweepKey]} ${mark.value.toFixed(definition.digits)} ${definition.unit} · Rth ${mark.rth.toPrecision(3)} K/W · Δp ${mark.dpKpa.toPrecision(3)} kPa${mark.out ? ` · ${copy.outsideRange}` : ''}`;
  }
  function hideHover() {
    const hover = query<SVGCircleElement>('[data-chart-hover]');
    hover?.setAttribute('data-active', 'false');
    readout(chart?.current ?? null, copy.currentPoint);
  }

  function presentStream() {
    const sketch = streamlineSketch(state.params);
    const stream = query<SVGSVGElement>('[data-stream]');
    if (!stream) return;
    stream.setAttribute('viewBox', sketch.viewBox);
    const channel = query<SVGRectElement>('[data-stream-channel]');
    channel?.setAttribute('width', String(sketch.length));
    channel?.setAttribute('height', String(sketch.width));
    query('[data-stream-pins]')?.setAttribute('d', sketch.pins);
    query('[data-stream-lines]')?.replaceChildren(
      ...sketch.lines.map((d, index) => svg('path', { d, style: `--line:${index}` })),
    );
  }

  function recalculate() {
    frame = 0;
    if (disposed) return;
    const next = evaluate(state.params);
    const error = query<HTMLElement>('[data-input-error]');
    const noPins = query<HTMLElement>('[data-no-pins]');
    presentInputs();
    if (!next.ok) {
      if (error) error.hidden = next.reason !== 'invalid';
      if (noPins) noPins.hidden = next.reason !== 'no-pins';
      return;
    }
    if (error) error.hidden = true;
    if (noPins) noPins.hidden = true;
    const values = headline(next);
    setText('[data-value="rth"]', values.rth);
    setText('[data-value="dp"]', values.dp);
    setText('[data-value="h"]', values.h);
    setText('[data-value="re"]', values.re);
    setText('[data-value="regime"]', copy.regimes[next.regime]);
    setText('[data-control-rth]', values.rth);
    setText('[data-control-dp]', values.dp);
    for (const [key, value] of Object.entries(details(next)))
      setText(`[data-detail="${key}"]`, value);
    setText('[data-detail="pumping"]', `${values.pumping} W`);
    setText('[data-detail="tBase"]', `${values.tBase} °C`);
    const status = presentValidity(next);
    presentStream();
    presentChart();
    viewer?.update(state.params);
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      setText(
        '[data-result-live]',
        `${copy.currentResult}: Rth ${values.rth} K/W, Δp ${values.dp} kPa. ${status}.`,
      );
    }, 300);
  }
  function queue() {
    if (!frame && !disposed) frame = window.requestAnimationFrame(recalculate);
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
      presentChart();
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
      if (!chart?.marks.length) return;
      const box = chartSvg.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width) * CHART.width;
      const y = ((event.clientY - box.top) / box.height) * CHART.height;
      let best = chart.marks[0]!;
      for (const mark of chart.marks)
        if (Math.hypot(mark.x - x, mark.y - y) < Math.hypot(best.x - x, best.y - y)) best = mark;
      const hover = query<SVGCircleElement>('[data-chart-hover]');
      hover?.setAttribute('cx', String(best.x));
      hover?.setAttribute('cy', String(best.y));
      hover?.setAttribute('data-active', 'true');
      readout(best, '→');
    },
    { signal },
  );
  chartSvg?.addEventListener('pointerleave', hideHover, { signal });

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
    setText('[data-load-status]', copy.loading);
    try {
      const { createPinFinViewer } = await import('./viewer');
      if (disposed) return;
      viewer = createPinFinViewer({
        container: canvas!,
        label: copy.stageLabel,
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

  presentInputs();
  showPart(state.selected);
  if (staticMode) fallback();
  else if (manualLoad && loadButton) {
    root.dataset.load = 'manual';
    loadButton.hidden = false;
    setText('[data-load-status]', copy.manualLoad);
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
      window.clearTimeout(announceTimer);
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
