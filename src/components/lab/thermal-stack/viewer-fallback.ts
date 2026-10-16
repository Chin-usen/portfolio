import { sampleTemperature } from './field-sampler';
import type { ThermalLayerId, ThermalParams, ThermalResult } from './types';
import {
  CSS_PALETTE,
  easedProgress,
  layoutLayers,
  paletteIndex,
  type DisplayLayer,
  type ThermalViewer,
  type ThermalViewerOptions,
} from './viewer-shared';

const NS = 'http://www.w3.org/2000/svg';
const COLS = 28;
const ROWS = 6;
interface CrossSectionLayer {
  group: SVGGElement;
  cells: SVGRectElement[];
  outline: SVGRectElement;
  display: DisplayLayer;
}

/** Accessible SVG fallback: the same model and color scale, always a central cross-section. */
export function createFallbackViewer(options: ThermalViewerOptions): ThermalViewer {
  const { container, onHover, onSelect } = options;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-18 -14 36 28');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'group');
  svg.setAttribute(
    'aria-label',
    options.labels?.fallbackStage ??
      container.getAttribute('aria-label') ??
      'Interactive thermal cross-section.',
  );
  svg.style.cssText = 'display:block;width:100%;height:100%;overflow:visible;';
  svg.dataset.thermalCanvas = 'fallback';
  container.dataset.thermalRenderer = 'fallback';
  // A role=img ancestor hides interactive SVG descendants from assistive technology.
  container.setAttribute('role', 'group');
  if (options.labels?.fallbackStage)
    container.setAttribute('aria-label', options.labels.fallbackStage);
  container.append(svg);
  const groups = new Map<ThermalLayerId, CrossSectionLayer>();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected: ThermalLayerId | null = null;
  let hovered: ThermalLayerId | null = null;
  let isCutaway = false;
  let isExploded = false;
  let explodeProgress = 0;
  let animationStart = 0;
  let animateFrom = 0;
  let animateTo = 0;
  let animating = false;
  let raf = 0;
  let renderCount = 0;
  let disposed = false;
  const listenerCleanup: Array<() => void> = [];
  function listen<T extends Event>(
    target: EventTarget,
    type: string,
    listener: (event: T) => void,
  ) {
    target.addEventListener(type, listener as EventListener);
    listenerCleanup.push(() => target.removeEventListener(type, listener as EventListener));
  }
  let lastUpdateMs = 0;
  let dirty = false;
  let latest: { params: ThermalParams; result: ThermalResult } | null = null;

  function invalidate() {
    if (!disposed && raf === 0 && !document.hidden) raf = requestAnimationFrame(render);
  }

  function highlight() {
    for (const [id, entry] of groups) {
      const active = id === selected || id === hovered;
      entry.outline.setAttribute('stroke', active ? '#66b7ff' : '#7b8090');
      entry.outline.setAttribute('stroke-opacity', active ? '1' : '0.6');
      entry.outline.setAttribute('stroke-width', active ? '2.3' : '1');
      entry.group.setAttribute('aria-pressed', String(id === selected));
    }
  }

  function hover(id: ThermalLayerId | null) {
    if (hovered === id) return;
    hovered = id;
    highlight();
    onHover?.(id);
  }

  function select(id: ThermalLayerId | null) {
    selected = id;
    highlight();
    onSelect?.(id);
  }

  function makeLayer(display: DisplayLayer): CrossSectionLayer {
    const group = document.createElementNS(NS, 'g');
    group.dataset.thermalLayer = display.layer.id;
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute(
      'aria-label',
      options.labels?.layers?.[display.layer.id] ?? display.layer.name,
    );
    group.setAttribute('aria-pressed', 'false');
    group.style.cursor = 'pointer';
    const cells: SVGRectElement[] = [];
    for (let index = 0; index < COLS * ROWS; index += 1) {
      const cell = document.createElementNS(NS, 'rect');
      cell.setAttribute('pointer-events', 'none');
      group.append(cell);
      cells.push(cell);
    }
    const outline = document.createElementNS(NS, 'rect');
    outline.setAttribute('fill', 'transparent');
    outline.setAttribute('vector-effect', 'non-scaling-stroke');
    group.append(outline);
    listen(group, 'pointerenter', () => hover(display.layer.id));
    listen(group, 'pointerleave', () => hover(null));
    listen(group, 'focus', () => hover(display.layer.id));
    listen(group, 'blur', () => hover(null));
    listen(group, 'click', () => select(display.layer.id));
    listen(group, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select(display.layer.id);
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        select(null);
      }
    });
    svg.append(group);
    const entry = { group, cells, outline, display };
    groups.set(display.layer.id, entry);
    return entry;
  }

  function applyUpdate() {
    if (!latest) return;
    const start = performance.now();
    for (const display of layoutLayers(latest.result.layers)) {
      const entry = groups.get(display.layer.id) ?? makeLayer(display);
      entry.display = display;
      const { layer, height } = display;
      const cellWidth = layer.width / COLS;
      const cellHeight = height / ROWS;
      for (let row = 0; row < ROWS; row += 1) {
        for (let column = 0; column < COLS; column += 1) {
          const cell = entry.cells[row * COLS + column]!;
          const x = -layer.width / 2 + column * cellWidth;
          const chebyshev = Math.abs(x + cellWidth / 2);
          const temperature =
            sampleTemperature(
              latest.result,
              layer,
              1 - (row + 0.5) / ROWS,
              chebyshev,
              latest.params.T_cool,
            ) ?? latest.params.T_cool;
          cell.setAttribute('x', String(x));
          cell.setAttribute('y', String(-height / 2 + row * cellHeight));
          cell.setAttribute('width', String(cellWidth + 0.007));
          cell.setAttribute('height', String(cellHeight + 0.007));
          cell.setAttribute(
            'fill',
            CSS_PALETTE[paletteIndex(temperature, latest.result)] ?? '#16123A',
          );
        }
      }
      entry.outline.setAttribute('x', String(-layer.width / 2));
      entry.outline.setAttribute('y', String(-height / 2));
      entry.outline.setAttribute('width', String(layer.width));
      entry.outline.setAttribute('height', String(height));
      entry.group.setAttribute(
        'aria-label',
        `${options.labels?.layers?.[layer.id] ?? layer.name} · ${layer.thickness} mm · ${layer.tTop.toFixed(1)}–${layer.tBottom.toFixed(1)} °C`,
      );
    }
    highlight();
    lastUpdateMs = performance.now() - start;
    dirty = false;
  }

  function render(now: number) {
    raf = 0;
    if (disposed) return;
    if (dirty) applyUpdate();
    if (animating) {
      explodeProgress = easedProgress(animationStart, animateFrom, animateTo, now);
      if (now - animationStart >= 400 || reducedMotion.matches) {
        explodeProgress = animateTo;
        animating = false;
      }
    }
    for (const entry of groups.values()) {
      const y = -(entry.display.center + entry.display.explodeOffset * explodeProgress);
      entry.group.setAttribute('transform', `translate(0 ${y})`);
    }
    renderCount += 1;
    if (animating) invalidate();
  }

  function reset() {
    svg.setAttribute('viewBox', '-18 -14 36 28');
    invalidate();
  }
  function visibility() {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!document.hidden) invalidate();
  }
  listen(svg, 'dblclick', reset);
  listen(document, 'visibilitychange', visibility);

  return {
    update(params, result) {
      latest = { params: { ...params }, result };
      dirty = true;
      invalidate();
    },
    setCutaway(enabled) {
      // The fallback already displays the central cut face, so its thermal data remain unchanged.
      isCutaway = enabled;
      svg.dataset.cutaway = String(enabled);
      invalidate();
    },
    setExploded(enabled) {
      if (isExploded === enabled) return;
      isExploded = enabled;
      animateFrom = explodeProgress;
      animateTo = enabled ? 1 : 0;
      animationStart = performance.now();
      animating = !reducedMotion.matches;
      if (!animating) explodeProgress = animateTo;
      invalidate();
    },
    setSelected(id) {
      selected = id;
      highlight();
    },
    reset,
    getDiagnostics() {
      return {
        mode: 'fallback',
        renderCount,
        scheduledFrame: raf !== 0,
        layerCount: groups.size,
        geometryCount: 0,
        vertexCount: 0,
        selectedId: selected,
        hoveredId: hovered,
        cutaway: isCutaway,
        exploded: isExploded,
        explodeProgress,
        lastUpdateMs,
        pixelRatio: 1,
        disposed,
        ownedListeners: listenerCleanup.length,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      for (const remove of listenerCleanup.splice(0)) remove();
      svg.remove();
      groups.clear();
    },
  };
}
