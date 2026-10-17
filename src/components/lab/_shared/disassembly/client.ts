import type {
  ControllerOptions,
  ControllerSnapshot,
  DisassemblyAddon,
  DisassemblyViewer,
  ProjectedAnchor,
  RootController,
  PartView,
} from './types';

export function prefersStaticDisassembly(device: {
  search: string;
  reducedMotion: boolean;
  saveData?: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}) {
  return (
    new URLSearchParams(device.search).get('renderer') === '2d' ||
    device.reducedMotion ||
    device.saveData === true ||
    (device.deviceMemory !== undefined && device.deviceMemory <= 2) ||
    (device.hardwareConcurrency !== undefined &&
      device.hardwareConcurrency > 0 &&
      device.hardwareConcurrency <= 2)
  );
}

/** Read the serialized localized PartViews emitted by DisassemblyPage. */
export function readDisassemblyParts(root: HTMLElement): PartView[] {
  const content = root.querySelector<HTMLScriptElement>('[data-l1-content]');
  const value: unknown = JSON.parse(content?.textContent || '[]');
  const ids = new Set<string>();
  if (!Array.isArray(value) || !value.length) throw new Error('Missing disassembly parts');
  for (const part of value) {
    if (
      !part ||
      typeof part !== 'object' ||
      !['id', 'name', 'short', 'role', 'features', 'material'].every(
        (key) => typeof part[key] === 'string' && part[key].length > 0,
      ) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part.id) ||
      ids.has(part.id) ||
      (part.secondaryName !== undefined && typeof part.secondaryName !== 'string')
    )
      throw new Error('Invalid disassembly parts');
    ids.add(part.id);
  }
  return value as PartView[];
}

export function createDisassemblyController<
  Id extends string,
  Mode extends string,
  Viewer extends DisassemblyViewer<Id, Mode>,
>(
  root: HTMLElement,
  options: ControllerOptions<Id, Mode, Viewer>,
  instance: number,
  onDispose: (snapshot: ControllerSnapshot<ReturnType<Viewer['getDiagnostics']>>) => void,
): RootController<ReturnType<Viewer['getDiagnostics']>> | null {
  const query = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const all = <T extends Element>(selector: string) => [...root.querySelectorAll<T>(selector)];
  const container = query<HTMLElement>('[data-l1-canvas]');
  const stage = query<HTMLElement>('[data-l1-stage]');
  const preview = query<HTMLImageElement>('[data-l1-preview]');
  if (!container || !stage) return null;
  const { parts, modes, copy } = options;
  if (
    !parts.some((part) => part.id === options.defaultPartId) ||
    !modes.some((mode) => mode.id === options.defaultMode)
  )
    throw new Error('Invalid disassembly initial selection or mode');
  const abort = new AbortController();
  const { signal } = abort;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const device = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const staticPreferred = () =>
    prefersStaticDisassembly({
      search: location.search,
      reducedMotion: reduced.matches,
      saveData: device.connection?.saveData,
      deviceMemory: device.deviceMemory,
      hardwareConcurrency: device.hardwareConcurrency,
    });
  let selected = options.defaultPartId;
  let mode = options.defaultMode;
  let viewer: Viewer | null = null;
  let disposed = false;
  let requested = false;
  let pendingLoad = false;
  let loadEpoch = 0;
  let idle = 0;
  let timeout = 0;
  let fontsPending = false;
  let observer: IntersectionObserver | null = null;
  let observerConnected = false;
  const setText = (selector: string, text: string) => {
    const element = query<HTMLElement>(selector);
    if (element) element.textContent = text;
  };
  // Addons may call present() during mount, before their hooks are returned.
  let addon: DisassemblyAddon<Viewer> | undefined = undefined;
  function select(id: Id) {
    if (disposed) return;
    const part = parts.find((item) => item.id === id);
    if (!part) return;
    selected = id;
    root.dataset.selected = id;
    for (const element of all<HTMLElement | SVGElement>('[data-l1-select], [data-l1-label]'))
      element.setAttribute(
        'aria-pressed',
        String((element.dataset.l1Select ?? element.dataset.l1Label) === id),
      );
    for (const element of all<SVGPathElement>('[data-l1-leader]'))
      element.dataset.selected = String(element.dataset.l1Leader === id);
    for (const key of ['name', 'role', 'features', 'material'] as const)
      setText(`[data-l1-${key}]`, part[key]);
    setText('[data-l1-name-secondary]', part.secondaryName ?? '');
    viewer?.setSelected(id);
  }
  function modePresentation() {
    const fallback = root.dataset.renderer === 'fallback';
    root.dataset.mode = mode;
    for (const button of all<HTMLButtonElement>('[data-l1-mode]'))
      button.setAttribute('aria-pressed', String(button.dataset.l1Mode === mode));
    const modeDefinition = modes.find((item) => item.id === mode)!;
    const labels = query<HTMLElement>('[data-l1-labels]');
    if (labels)
      labels.hidden =
        root.dataset.renderer !== 'webgl' || !modes.find((item) => item.id === mode)?.showLabels;
    const leaders = query<SVGElement>('[data-l1-leaders]');
    if (leaders)
      leaders.style.display =
        root.dataset.renderer === 'webgl' && Boolean(modeDefinition.showLabels) ? '' : 'none';
    const caption = modeDefinition.caption;
    setText('[data-l1-caption]', fallback ? `${caption}. ${copy.staticMode}` : caption);
    addon?.onPresentation?.();
  }
  function setMode(next: Mode) {
    if (disposed || !modes.some((item) => item.id === next)) return;
    mode = next;
    viewer?.setMode(mode);
    addon?.onMode?.();
    modePresentation();
  }
  function project(anchors: ProjectedAnchor<Id>[]) {
    if (disposed || !modes.find((item) => item.id === mode)?.showLabels) return;
    const width = stage!.clientWidth;
    const height = stage!.clientHeight;
    const columns = [
      anchors.filter((_, index) => index % 2 === 0),
      anchors.filter((_, index) => index % 2 === 1),
    ];
    columns.forEach((column, side) => {
      column
        .sort((a, b) => a.y - b.y)
        .forEach((anchor, index) => {
          const label = query<HTMLButtonElement>(`[data-l1-label="${anchor.id}"]`);
          const path = query<SVGPathElement>(`[data-l1-leader="${anchor.id}"]`);
          if (!label || !path) return;
          label.hidden = !anchor.visible;
          const left = side === 0 ? 2 : width - label.offsetWidth - 2;
          const top = Math.max(
            8,
            Math.min(height - 52, ((index + 0.65) * height) / column.length - 30),
          );
          label.style.left = `${left}px`;
          label.style.top = `${top}px`;
          const endX = side === 0 ? left + label.offsetWidth : left;
          const endY = top + label.offsetHeight / 2;
          path.setAttribute(
            'd',
            anchor.visible
              ? `M ${anchor.x} ${anchor.y} L ${endX + (side === 0 ? 14 : -14)} ${endY} H ${endX}`
              : '',
          );
        });
    });
  }
  function cancelSchedule() {
    observer?.disconnect();
    observerConnected = false;
    if (idle) window.cancelIdleCallback?.(idle);
    if (timeout) window.clearTimeout(timeout);
    idle = timeout = 0;
  }
  function fallback(failure = false) {
    if (disposed) return;
    loadEpoch += 1;
    cancelSchedule();
    viewer?.dispose();
    root.dataset.renderer = 'fallback';
    if (preview) preview.hidden = false;
    pendingLoad = false;
    setText(
      '[data-l1-status]',
      `${copy.fallback} ${failure ? copy.loadFailure : copy.fallbackReason}`,
    );
    modePresentation();
  }
  async function loadViewer() {
    if (disposed || requested) return;
    if (staticPreferred()) {
      fallback();
      return;
    }
    requested = true;
    pendingLoad = true;
    const epoch = ++loadEpoch;
    cancelSchedule();
    try {
      const createViewer = await options.loadViewer();
      if (disposed || epoch !== loadEpoch) return;
      if (staticPreferred()) {
        fallback();
        return;
      }
      let failed = false;
      const created = createViewer({
        container: container!,
        label: copy.stage,
        keyboardDescriptionId: options.keyboardDescriptionId,
        onSelect: select,
        onProject: project,
        onReady() {
          if (disposed || failed || epoch !== loadEpoch) return;
          if (staticPreferred()) {
            fallback();
            return;
          }
          pendingLoad = false;
          root.dataset.renderer = 'webgl';
          if (preview) preview.hidden = true;
          modePresentation();
        },
        onError: () => {
          if (disposed || epoch !== loadEpoch) return;
          failed = true;
          fallback(true);
        },
      });
      if (disposed || failed || epoch !== loadEpoch) {
        created.dispose();
        return;
      }
      viewer = created;
      viewer.setSelected(selected);
      viewer.setMode(mode);
      addon?.onViewer?.(viewer);
    } catch {
      if (!disposed && epoch === loadEpoch) fallback(true);
    } finally {
      if (disposed || root.dataset.renderer === 'fallback') pendingLoad = false;
    }
  }
  function schedule() {
    if (disposed || requested || fontsPending || idle || timeout) return;
    fontsPending = true;
    void document.fonts.ready.then(() => {
      fontsPending = false;
      if (disposed || requested) return;
      if (typeof window.requestIdleCallback === 'function')
        idle = window.requestIdleCallback(
          () => {
            idle = 0;
            void loadViewer();
          },
          { timeout: 1500 },
        );
      else
        timeout = window.setTimeout(() => {
          timeout = 0;
          void loadViewer();
        }, 0);
    });
  }
  for (const element of all<HTMLElement | SVGElement>('[data-l1-select], [data-l1-label]')) {
    element.addEventListener(
      'click',
      () => {
        const id = element.dataset.l1Select ?? element.dataset.l1Label;
        if (id && parts.some((part) => part.id === id)) select(id as Id);
      },
      { signal },
    );
    if (element instanceof SVGElement)
      element.addEventListener(
        'keydown',
        (event) => {
          const key = (event as KeyboardEvent).key;
          if (key === 'Enter' || key === ' ') {
            event.preventDefault();
            const id = element.dataset.l1Select ?? element.dataset.l1Label;
            if (id && parts.some((part) => part.id === id)) select(id as Id);
          }
        },
        { signal },
      );
  }
  for (const button of all<HTMLButtonElement>('[data-l1-mode]'))
    button.addEventListener('click', () => setMode(button.dataset.l1Mode as Mode), {
      signal,
    });
  query<HTMLButtonElement>('[data-l1-reset]')?.addEventListener('click', () => viewer?.reset(), {
    signal,
  });
  container.addEventListener('pointerdown', () => void loadViewer(), { signal });
  container.addEventListener('focusin', () => void loadViewer(), { signal });
  reduced.addEventListener(
    'change',
    () => {
      if (reduced.matches) {
        addon?.onReducedMotion?.();
        fallback();
      }
    },
    { signal },
  );
  const snapshot = (): ControllerSnapshot<ReturnType<Viewer['getDiagnostics']>> => ({
    instance,
    disposed,
    listenersAborted: signal.aborted,
    observersConnected: observerConnected,
    pendingLoad: !disposed && pendingLoad,
    viewer: viewer ? (viewer.getDiagnostics() as ReturnType<Viewer['getDiagnostics']>) : null,
  });
  const controller = {
    snapshot,
    dispose() {
      if (disposed) return;
      disposed = true;
      pendingLoad = false;
      abort.abort();
      cancelSchedule();
      addon?.dispose?.();
      viewer?.dispose();
      onDispose(snapshot());
      viewer = null;
    },
  };
  addon = options.mountAddon?.({
    root,
    signal,
    reduced,
    query,
    all,
    setText,
    select,
    setMode,
    present: modePresentation,
    get viewer() {
      return viewer;
    },
    get mode() {
      return mode;
    },
    get selected() {
      return selected;
    },
    get disposed() {
      return disposed;
    },
  });
  select(selected);
  modePresentation();
  if (staticPreferred()) fallback();
  else if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) schedule();
      },
      { rootMargin: '0px' },
    );
    observer.observe(container);
    observerConnected = true;
  } else schedule();
  return controller;
}

/** One registry per page adapter; no Three objects escape in diagnostics. */
export function createDisassemblyLifecycle<Diagnostics>(options: {
  selector: string;
  diagnosticName?: string;
  initialize(
    root: HTMLElement,
    instance: number,
    onDispose: (snapshot: ControllerSnapshot<Diagnostics>) => void,
  ): RootController<Diagnostics> | null;
}) {
  const active = new Map<HTMLElement, RootController<Diagnostics>>();
  const released: ControllerSnapshot<Diagnostics>[] = [];
  let initialized = 0;
  let disposed = 0;
  let registered = false;
  const snapshot = () =>
    structuredClone({
      initialized,
      disposed,
      active: [...active.values()].map((item) => item.snapshot()),
      released,
    });
  function dispose() {
    for (const item of [...active.values()]) item.dispose();
  }
  function initialize() {
    if (!registered) {
      registered = true;
      document.addEventListener('astro:before-swap', dispose);
      document.addEventListener('astro:page-load', initialize);
      window.addEventListener('pagehide', (event) => {
        if (!event.persisted) dispose();
      });
      if (options.diagnosticName)
        Object.defineProperty(window, options.diagnosticName, {
          value: Object.freeze({ snapshot }),
        });
    }
    for (const root of document.querySelectorAll<HTMLElement>(options.selector)) {
      if (active.has(root)) continue;
      const controller = options.initialize(root, initialized + 1, (value) => {
        active.delete(root);
        disposed += 1;
        released.push(value);
        if (released.length > 20) released.shift();
      });
      if (controller) {
        initialized += 1;
        active.set(root, controller);
      }
    }
  }
  return { initialize, dispose, snapshot };
}
