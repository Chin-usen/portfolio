import { afterEach, expect, it, vi } from 'vitest';
import {
  createDisassemblyController,
  createDisassemblyLifecycle,
  readDisassemblyParts,
} from '../../src/components/lab/_shared/disassembly/client';
import type {
  ControllerOptions,
  ViewerOptions,
} from '../../src/components/lab/_shared/disassembly/types';

class ElementStub extends EventTarget {
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  style: Record<string, string> = {};
  hidden = false;
  textContent = '';
  clientWidth = 600;
  clientHeight = 400;
  one = new Map<string, ElementStub>();
  many = new Map<string, ElementStub[]>();
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  querySelector(selector: string) {
    return this.one.get(selector) ?? null;
  }
  querySelectorAll(selector: string) {
    return this.many.get(selector) ?? [];
  }
}
const parts = ['first', 'second'].map((id) => ({
  id,
  name: `${id} name`,
  short: id,
  role: `${id} role`,
  features: `${id} features`,
  material: `${id} material`,
}));
function fixture(reason = '') {
  const root = new ElementStub();
  const canvas = new ElementStub();
  root.one.set('[data-l1-canvas]', canvas);
  for (const key of [
    'stage',
    'preview',
    'name',
    'name-secondary',
    'role',
    'features',
    'material',
    'caption',
    'status',
    'labels',
    'leaders',
    'reset',
  ])
    root.one.set(`[data-l1-${key}]`, new ElementStub());
  const tags = parts.map((part) => {
    const node = new ElementStub();
    node.dataset.l1Select = part.id;
    return node;
  });
  const modeButton = new ElementStub();
  modeButton.dataset.l1Mode = 'assembled';
  root.many.set('[data-l1-select], [data-l1-label]', tags);
  root.many.set('[data-l1-mode]', [modeButton]);
  const reduced = Object.assign(new EventTarget(), { matches: reason === 'reduced' });
  const win = Object.assign(new EventTarget(), {
    matchMedia: () => reduced,
    setTimeout,
    clearTimeout,
  });
  const doc = Object.assign(new EventTarget(), {
    fonts: { ready: new Promise<void>(() => {}) },
    querySelectorAll: () => [root],
  });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('SVGElement', class extends ElementStub {});
  vi.stubGlobal('location', { search: reason === 'query' ? '?renderer=2d' : '' });
  vi.stubGlobal('navigator', {
    hardwareConcurrency: reason === 'cores' ? 2 : 8,
    deviceMemory: reason === 'memory' ? 2 : 8,
    connection: { saveData: reason === 'save-data' },
  });
  const viewer = {
    setSelected: vi.fn(),
    setMode: vi.fn(),
    reset: vi.fn(),
    dispose: vi.fn(),
    getDiagnostics: () => ({ released: viewer.dispose.mock.calls.length > 0 }),
  };
  const factory = vi.fn((callbacks: ViewerOptions<string>) => {
    callbacks.onReady();
    return viewer;
  });
  const loadViewer = vi.fn(async () => factory);
  const options: ControllerOptions<string, string, typeof viewer> = {
    parts,
    modes: [
      { id: 'exploded', label: 'Exploded', caption: 'Exploded caption', showLabels: true },
      { id: 'assembled', label: 'Assembled', caption: 'Assembled caption' },
    ],
    defaultPartId: 'first',
    defaultMode: 'exploded',
    keyboardDescriptionId: 'example-keyboard',
    copy: {
      stage: 'Model',
      staticMode: 'Static',
      fallback: 'Fallback',
      loadFailure: 'Download failed',
      fallbackReason: 'Device policy',
    },
    loadViewer,
  };
  return {
    root,
    element: root as unknown as HTMLElement,
    canvas,
    tags,
    modeButton,
    options,
    loadViewer,
    factory,
    viewer,
    doc,
    win,
    reduced,
  };
}
afterEach(() => vi.unstubAllGlobals());

for (const reason of ['query', 'reduced', 'save-data', 'memory', 'cores']) {
  it(`keeps part and mode controls usable without importing WebGL for ${reason}`, () => {
    const f = fixture(reason);
    const released = vi.fn();
    const controller = createDisassemblyController(f.element, f.options, 1, released)!;
    expect(f.root.dataset.renderer).toBe('fallback');
    expect(f.root.one.get('[data-l1-preview]')!.hidden).toBe(false);
    f.canvas.dispatchEvent(new Event('pointerdown'));
    f.tags[1]!.dispatchEvent(new Event('click'));
    expect(f.root.one.get('[data-l1-name]')!.textContent).toBe('second name');
    expect(f.tags[1]!.attributes.get('aria-pressed')).toBe('true');
    f.modeButton.dispatchEvent(new Event('click'));
    expect(f.root.one.get('[data-l1-caption]')!.textContent).toBe('Assembled caption. Static');
    expect(f.loadViewer).not.toHaveBeenCalled();
    controller.dispose();
    controller.dispose();
    f.tags[0]!.dispatchEvent(new Event('click'));
    expect(f.root.dataset.selected).toBe('second');
    expect(released).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()).toMatchObject({
      disposed: true,
      listenersAborted: true,
      pendingLoad: false,
      observersConnected: false,
    });
  });
}

it('does not construct a viewer when its module finishes importing after route disposal', async () => {
  const f = fixture();
  let finish!: (factory: typeof f.factory) => void;
  f.options.loadViewer = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const controller = createDisassemblyController(f.element, f.options, 1, vi.fn())!;
  f.canvas.dispatchEvent(new Event('pointerdown'));
  expect(controller.snapshot().pendingLoad).toBe(true);
  controller.dispose();
  finish(f.factory);
  await Promise.resolve();
  expect(f.factory).not.toHaveBeenCalled();
  expect(controller.snapshot().pendingLoad).toBe(false);
});

it('releases a synchronously failed factory result and leaves its static controls active', async () => {
  const f = fixture();
  f.options.loadViewer = async () => (callbacks) => {
    callbacks.onError();
    return f.viewer;
  };
  const controller = createDisassemblyController(f.element, f.options, 1, vi.fn())!;
  f.canvas.dispatchEvent(new Event('pointerdown'));
  await Promise.resolve();
  expect(f.viewer.dispose).toHaveBeenCalledTimes(1);
  expect(f.root.dataset.renderer).toBe('fallback');
  f.tags[1]!.dispatchEvent(new Event('click'));
  expect(f.root.dataset.selected).toBe('second');
  controller.dispose();
  expect(f.viewer.dispose).toHaveBeenCalledTimes(1);
});

it('registers a root once per visit, keeps BFCache ownership and bounds released snapshots', async () => {
  const f = fixture();
  const lifecycle = createDisassemblyLifecycle({
    selector: '[data-example]',
    initialize: (root, instance, onDispose) =>
      createDisassemblyController(root, f.options, instance, onDispose),
  });
  lifecycle.initialize();
  lifecycle.initialize();
  f.canvas.dispatchEvent(new Event('pointerdown'));
  await Promise.resolve();
  await Promise.resolve();
  expect(lifecycle.snapshot().initialized).toBe(1);
  expect(f.viewer.setSelected).toHaveBeenCalledWith('first');
  f.win.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }));
  expect(lifecycle.snapshot().active).toHaveLength(1);
  f.doc.dispatchEvent(new Event('astro:before-swap'));
  expect(lifecycle.snapshot().active).toHaveLength(0);
  expect(f.viewer.dispose).toHaveBeenCalledTimes(1);
  for (let index = 0; index < 22; index += 1) {
    f.doc.dispatchEvent(new Event('astro:page-load'));
    f.doc.dispatchEvent(new Event('astro:before-swap'));
  }
  const snapshot = lifecycle.snapshot();
  expect(snapshot.initialized).toBe(23);
  expect(snapshot.disposed).toBe(23);
  expect(snapshot.released).toHaveLength(20);
  snapshot.released.length = 0;
  expect(lifecycle.snapshot().released).toHaveLength(20);
});

it('rejects duplicate or unsafe serialized part ids before creating interactive controls', () => {
  const f = fixture('query');
  const content = new ElementStub();
  f.root.one.set('[data-l1-content]', content);
  content.textContent = JSON.stringify(parts);
  expect(readDisassemblyParts(f.element)).toEqual(parts);
  content.textContent = JSON.stringify([parts[0], parts[0]]);
  expect(() => readDisassemblyParts(f.element)).toThrow('Invalid disassembly parts');
  content.textContent = JSON.stringify([{ ...parts[0], id: 'a"]' }]);
  expect(() => readDisassemblyParts(f.element)).toThrow('Invalid disassembly parts');
});

it('ignores late viewer callbacks after reduced-motion fallback, even when the preference changes back', async () => {
  const f = fixture();
  let callbacks!: ViewerOptions<string>;
  f.options.loadViewer = async () => (options) => {
    callbacks = options;
    return f.viewer;
  };
  const controller = createDisassemblyController(f.element, f.options, 1, vi.fn())!;
  f.canvas.dispatchEvent(new Event('pointerdown'));
  await Promise.resolve();
  expect(controller.snapshot().pendingLoad).toBe(true);
  f.reduced.matches = true;
  f.reduced.dispatchEvent(new Event('change'));
  expect(f.viewer.dispose).toHaveBeenCalledTimes(1);
  expect(f.root.dataset.renderer).toBe('fallback');
  f.reduced.matches = false;
  callbacks.onReady();
  callbacks.onError();
  expect(f.root.dataset.renderer).toBe('fallback');
  expect(f.root.one.get('[data-l1-preview]')!.hidden).toBe(false);
  expect(f.root.one.get('[data-l1-status]')!.textContent).toBe('Fallback Device policy');
  expect(controller.snapshot().pendingLoad).toBe(false);
  f.tags[1]!.dispatchEvent(new Event('click'));
  expect(f.root.dataset.selected).toBe('second');
  controller.dispose();
});

it('cancels a pending module import when device policy changes before construction', async () => {
  const f = fixture();
  let finish!: (factory: typeof f.factory) => void;
  f.options.loadViewer = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const controller = createDisassemblyController(f.element, f.options, 1, vi.fn())!;
  f.canvas.dispatchEvent(new Event('pointerdown'));
  f.reduced.matches = true;
  f.reduced.dispatchEvent(new Event('change'));
  f.reduced.matches = false;
  finish(f.factory);
  await Promise.resolve();
  expect(f.factory).not.toHaveBeenCalled();
  expect(f.root.dataset.renderer).toBe('fallback');
  expect(controller.snapshot().pendingLoad).toBe(false);
  controller.dispose();
});
