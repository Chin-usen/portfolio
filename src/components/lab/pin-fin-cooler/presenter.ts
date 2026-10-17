/**
 * Calculation and result presentation. Loaded on the first interaction (or at idle after load)
 * so the initial page script stays small; the server HTML already carries the default results.
 */
import { CHART, chartModel, type ChartModel } from './chart';
import { pinFinCopy, type PinFinLocale } from './copy';
import { evaluate, type PinFinResult } from './evaluator';
import { details, formatCheckValue, formatRange, headline } from './format';
import { definitionOf, type NumericKey, type PinFinParams } from './parameters';
import { streamlineSketch } from './streamlines';
import { sweep } from './sweep';

const SVG = 'http://www.w3.org/2000/svg';

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

export interface PresenterState {
  params: PinFinParams;
  sweepKey: NumericKey;
}

export function createPresenter(root: HTMLElement, locale: PinFinLocale) {
  const copy = pinFinCopy[locale];
  const query = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const all = <T extends Element>(selector: string) => [...root.querySelectorAll<T>(selector)];
  const setText = (selector: string, value: string) => {
    const element = query<HTMLElement>(selector);
    if (element && element.textContent !== value) element.textContent = value;
  };
  let chart: ChartModel | null = null;
  let sweepKey: NumericKey = 'flow';
  let announceTimer = 0;

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

  function readout(mark: ChartModel['marks'][number] | null, prefix: string) {
    const element = query<HTMLElement>('[data-chart-readout]');
    if (!element || !mark) return;
    const definition = definitionOf(sweepKey);
    element.textContent = `${prefix}: ${copy.parameterLabels[sweepKey]} ${mark.value.toFixed(definition.digits)} ${definition.unit} · Rth ${mark.rth.toPrecision(3)} K/W · Δp ${mark.dpKpa.toPrecision(3)} kPa${mark.out ? ` · ${copy.outsideRange}` : ''}`;
  }

  function hideHover() {
    query<SVGCircleElement>('[data-chart-hover]')?.setAttribute('data-active', 'false');
    readout(chart?.current ?? null, copy.currentPoint);
  }

  function presentChart(state: PresenterState) {
    sweepKey = state.sweepKey;
    chart = chartModel(sweep(state.params, state.sweepKey));
    const grid = query<SVGGElement>('[data-chart-grid]');
    if (!grid) return;
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
    setText(
      '[data-chart-table-key]',
      `${copy.parameterLabels[state.sweepKey]} (${definition.unit})`,
    );
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

  function presentStream(params: PinFinParams) {
    const sketch = streamlineSketch(params);
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

  return {
    /** Returns false when the parameters cannot be evaluated. */
    recalculate(state: PresenterState): boolean {
      const next = evaluate(state.params);
      const error = query<HTMLElement>('[data-input-error]');
      const noPins = query<HTMLElement>('[data-no-pins]');
      if (!next.ok) {
        if (error) error.hidden = next.reason !== 'invalid';
        if (noPins) noPins.hidden = next.reason !== 'no-pins';
        return false;
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
      presentStream(state.params);
      presentChart(state);
      window.clearTimeout(announceTimer);
      announceTimer = window.setTimeout(() => {
        setText(
          '[data-result-live]',
          `${copy.currentResult}: Rth ${values.rth} K/W, Δp ${values.dp} kPa. ${status}.`,
        );
      }, 300);
      return true;
    },
    chart: presentChart,
    stream: presentStream,
    hover(event: PointerEvent, svgRoot: SVGSVGElement) {
      if (!chart?.marks.length) return;
      const box = svgRoot.getBoundingClientRect();
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
    hideHover,
    dispose() {
      window.clearTimeout(announceTimer);
    },
  };
}

export type Presenter = ReturnType<typeof createPresenter>;
