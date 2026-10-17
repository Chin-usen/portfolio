import { CONDUCTOR_IDS, latticeOffsets, type ConductorBox, type ConductorId } from './geometry.ts';
import {
  fieldRange,
  PALETTES,
  paletteIndex,
  type BusbarViewer,
  type BusbarViewerOptions,
  type FieldMode,
  type Probe,
  type ViewerState,
} from './viewer-shared.ts';

type PanelId = ConductorId | 'context';
const PANELS: PanelId[] = ['p-layer', 'n-layer', 'ac-link', 'context'];
interface Layout {
  id: PanelId;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  originX: number;
  originY: number;
}

/**
 * Accessible 2D plan view (Canvas 2D, no WebGL): one panel per conductor plus the substrate
 * context, drawn top-down from the same surrogate field and colour scales.
 */
export function createFallbackViewer(options: BusbarViewerOptions): BusbarViewer {
  const { container, onHover, onSelect, labels } = options;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', labels.fallbackStage);
  canvas.dataset.busbarCanvas = 'fallback';
  container.dataset.busbarRenderer = 'fallback';
  container.setAttribute('role', 'group');
  container.append(canvas);
  const context = canvas.getContext('2d');
  let latest: ViewerState | null = null;
  let fieldMode: FieldMode = 'temperature';
  let selected: ConductorId | null = null;
  let hovered: ConductorId | null = null;
  let layout: Layout[] = [];
  let raf = 0;
  let renderCount = 0;
  let lastUpdateMs = 0;
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
  const invalidate = () => {
    if (!disposed && raf === 0 && !document.hidden) raf = requestAnimationFrame(draw);
  };
  const css = (name: string, fallback: string) =>
    getComputedStyle(container).getPropertyValue(name).trim() || fallback;

  function computeLayout(width: number, height: number) {
    if (!latest) return [];
    const { min, max } = latest.geometry.bounds;
    const spanX = max[0] - min[0];
    const spanY = max[1] - min[1];
    const columns = width / height > 0.9 ? 2 : 1;
    const rows = PANELS.length / columns;
    const gap = 12;
    const titleHeight = 18;
    const cellWidth = (width - gap * (columns - 1)) / columns;
    const cellHeight = (height - gap * (rows - 1)) / rows;
    const scale = Math.min(cellWidth / spanX, (cellHeight - titleHeight) / spanY);
    return PANELS.map((id, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = column * (cellWidth + gap);
      const y = row * (cellHeight + gap);
      return {
        id,
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        scale,
        originX: x + (cellWidth - spanX * scale) / 2 - min[0] * scale,
        originY: y + titleHeight + (cellHeight - titleHeight - spanY * scale) / 2 + max[1] * scale,
      };
    });
  }

  function topValue(
    item: ConductorBox,
    offset: number,
    values: Float32Array,
    i: number,
    j: number,
  ) {
    const [nx, ny, nz] = item.lattice;
    return values[offset + i + (nx + 1) * (j + (ny + 1) * nz)]!;
  }

  function draw() {
    raf = 0;
    if (disposed || !context || !latest) return;
    const start = performance.now();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    layout = computeLayout(width, height);
    const text = css('--thermal-secondary', '#6e6e73');
    const line = css('--thermal-line', '#e5e5e9');
    const accent = '#2997ff';
    const range = fieldRange(latest, fieldMode);
    const lut = PALETTES[fieldMode].srgb;
    context.font = `12px ${getComputedStyle(container).fontFamily || 'system-ui, sans-serif'}`;
    for (const panel of layout) {
      const title =
        panel.id === 'context'
          ? labels.context
          : `${labels.conductors[panel.id]}${latest.result.conductors[panel.id].active ? '' : ` · ${labels.idle}`}`;
      context.fillStyle = text;
      context.fillText(title, panel.x + 2, panel.y + 12);
      const map = (x: number, y: number) =>
        [panel.originX + x * panel.scale, panel.originY - y * panel.scale] as const;
      if (panel.id === 'context') {
        for (const item of latest.geometry.context) {
          const [x0, y0] = map(item.min[0], item.max[1]);
          context.fillStyle =
            item.kind === 'ceramic'
              ? '#dcdcd6'
              : item.kind === 'drain-island'
                ? '#b3ada4'
                : item.kind === 'die'
                  ? '#3b4046'
                  : '#9aa0a6';
          context.fillRect(
            x0,
            y0,
            (item.max[0] - item.min[0]) * panel.scale,
            (item.max[1] - item.min[1]) * panel.scale,
          );
        }
        continue;
      }
      const conductor = latest.geometry.conductors[panel.id];
      const field = latest.fields?.[panel.id] ?? null;
      const active = latest.result.conductors[panel.id].active;
      const offsets = latticeOffsets(conductor);
      const order = conductor.boxes
        .map((item, index) => ({ item, index }))
        .sort((a, b) => a.item.max[2] - b.item.max[2]);
      for (const { item, index } of order) {
        const [nx, ny] = item.lattice;
        const cellW = (item.max[0] - item.min[0]) / nx;
        const cellH = (item.max[1] - item.min[1]) / ny;
        for (let j = 0; j < ny; j += 1) {
          for (let i = 0; i < nx; i += 1) {
            let fill = active ? '#b87a4b' : '#c4c7cc';
            if (field && active) {
              const values = fieldMode === 'temperature' ? field.rise : field.currentDensity;
              const base = fieldMode === 'temperature' ? latest.params.tSub : 0;
              const v =
                (topValue(item, offsets[index]!, values, i, j) +
                  topValue(item, offsets[index]!, values, i + 1, j) +
                  topValue(item, offsets[index]!, values, i, j + 1) +
                  topValue(item, offsets[index]!, values, i + 1, j + 1)) /
                  4 +
                base;
              const k = paletteIndex(v, range) * 3;
              fill = `rgb(${lut[k]} ${lut[k + 1]} ${lut[k + 2]})`;
            }
            const [ax, ay] = map(item.min[0] + i * cellW, item.min[1] + (j + 1) * cellH);
            const [bx, by] = map(item.min[0] + (i + 1) * cellW, item.min[1] + j * cellH);
            context.fillStyle = fill;
            // Pixel-snapped cells avoid anti-aliased seams between neighbours.
            const x0 = Math.floor(ax);
            const y0 = Math.floor(ay);
            context.fillRect(
              x0,
              y0,
              Math.max(1, Math.ceil(bx) - x0),
              Math.max(1, Math.ceil(by) - y0),
            );
          }
        }
      }
      const focused = panel.id === selected || panel.id === hovered;
      context.lineWidth = focused ? 2 : 1;
      context.strokeStyle = focused ? accent : line;
      for (const item of conductor.boxes) {
        const [x0, y0] = map(item.min[0], item.max[1]);
        context.strokeRect(
          x0,
          y0,
          (item.max[0] - item.min[0]) * panel.scale,
          (item.max[1] - item.min[1]) * panel.scale,
        );
      }
    }
    renderCount += 1;
    lastUpdateMs = performance.now() - start;
  }

  function locate(event: PointerEvent): { id: ConductorId; probe: Probe | null } | null {
    if (!latest) return null;
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const panel = layout.find(
      (entry) =>
        px >= entry.x &&
        px <= entry.x + entry.width &&
        py >= entry.y &&
        py <= entry.y + entry.height,
    );
    if (!panel || panel.id === 'context') return null;
    const x = (px - panel.originX) / panel.scale;
    const y = (panel.originY - py) / panel.scale;
    const conductor = latest.geometry.conductors[panel.id];
    const offsets = latticeOffsets(conductor);
    const hits = conductor.boxes
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) => x >= item.min[0] && x <= item.max[0] && y >= item.min[1] && y <= item.max[1],
      )
      .sort((a, b) => b.item.max[2] - a.item.max[2]);
    const top = hits[0];
    if (!top) return { id: panel.id, probe: null };
    const field = latest.fields?.[panel.id];
    if (!field) return { id: panel.id, probe: null };
    const { item, index } = top;
    const [nx, ny] = item.lattice;
    const fi = Math.min(nx - 1e-9, ((x - item.min[0]) / (item.max[0] - item.min[0])) * nx);
    const fj = Math.min(ny - 1e-9, ((y - item.min[1]) / (item.max[1] - item.min[1])) * ny);
    const i = Math.floor(fi);
    const j = Math.floor(fj);
    const a = fi - i;
    const b = fj - j;
    const bilinear = (values: Float32Array) =>
      topValue(item, offsets[index]!, values, i, j) * (1 - a) * (1 - b) +
      topValue(item, offsets[index]!, values, i + 1, j) * a * (1 - b) +
      topValue(item, offsets[index]!, values, i, j + 1) * (1 - a) * b +
      topValue(item, offsets[index]!, values, i + 1, j + 1) * a * b;
    return {
      id: panel.id,
      probe: {
        temperature: latest.params.tSub + bilinear(field.rise),
        currentDensity: bilinear(field.currentDensity),
      },
    };
  }

  listen(canvas, 'pointermove', (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const hit = locate(event);
    if ((hit?.id ?? null) !== hovered) {
      hovered = hit?.id ?? null;
      invalidate();
    }
    onHover?.(hovered, hit?.probe ?? null);
  });
  listen(canvas, 'pointerleave', () => {
    hovered = null;
    onHover?.(null, null);
    invalidate();
  });
  listen(canvas, 'click', (event: PointerEvent) => {
    selected = locate(event)?.id ?? null;
    onSelect?.(selected);
    invalidate();
  });
  listen(canvas, 'keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      selected = null;
      onSelect?.(null);
      invalidate();
    }
  });
  listen(document, 'visibilitychange', () => {
    if (!document.hidden) invalidate();
  });
  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidate);
  resizeObserver?.observe(container);

  return {
    update(state) {
      latest = state;
      invalidate();
    },
    setFieldMode(mode) {
      fieldMode = mode;
      invalidate();
    },
    setCutaway() {
      // The plan view already shows every conductor; the section has no 2D equivalent.
    },
    setExploded() {
      // Separate panels are the 2D equivalent of the exploded view.
    },
    setSelected(id) {
      selected = id;
      invalidate();
    },
    reset() {
      invalidate();
    },
    getDiagnostics() {
      return {
        mode: 'fallback',
        renderCount,
        scheduledFrame: raf !== 0,
        meshCount: CONDUCTOR_IDS.length,
        vertexCount: 0,
        selectedId: selected,
        hoveredId: hovered,
        cutaway: false,
        exploded: false,
        fieldMode,
        lastUpdateMs,
        disposed,
        ownedListeners: listenerCleanup.length,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      resizeObserver?.disconnect();
      for (const remove of listenerCleanup.splice(0)) remove();
      canvas.remove();
    },
  };
}
