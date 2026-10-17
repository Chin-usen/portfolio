import { afterEach, describe, expect, it, vi } from 'vitest';
import { createViewerLifetime } from '../../../../src/components/lab/_shared/viewer-lifetime';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, WebGLRenderer } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { createHalfBridgeViewer } from '../../../../src/components/lab/half-bridge/viewer';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: vi.fn(
      class {
        domElement = Object.assign(new EventTarget(), {
          dataset: {},
          style: {},
          ownerDocument: document,
          getRootNode: () => document,
          setAttribute: vi.fn(),
          remove: vi.fn(),
        });
        renderLists = { dispose: vi.fn() };
        info = { memory: { geometries: 0, textures: 0 }, programs: [] };
        contextLost = false;
        dispose = vi.fn();
        forceContextLoss = vi.fn(() => {
          this.contextLost = true;
        });
        getContext = () => ({ isContextLost: () => this.contextLost });
        setClearColor = vi.fn();
        setPixelRatio = vi.fn();
        setSize = vi.fn();
        render = vi.fn();
      },
    ),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('viewer resource ownership', () => {
  it('aborts first, deduplicates shared resources, closes owned images and releases native context last', () => {
    const events: string[] = [];
    const scope = createViewerLifetime();
    scope.signal.addEventListener('abort', () => events.push('abort'));
    const geometry = { dispose: vi.fn(() => events.push('geometry')) };
    const texture = { isTexture: true as const, dispose: vi.fn(() => events.push('texture')) };
    const bitmap = { close: vi.fn(() => events.push('bitmap')) };
    const material = {
      map: texture,
      uniforms: { repeated: { value: [texture] } },
      dispose: vi.fn(() => events.push('material')),
    };
    const renderer = {
      renderLists: { dispose: vi.fn(() => events.push('lists')) },
      dispose: vi.fn(() => events.push('renderer')),
      forceContextLoss: vi.fn(() => events.push('context')),
      domElement: { remove: vi.fn(() => events.push('canvas')) },
    };
    const controls = { dispose: vi.fn(() => events.push('controls')) };
    scope.defer(() => controls.dispose());
    scope.ownRenderer(renderer);
    scope.ownRenderer(renderer);
    scope.own(geometry);
    scope.own(geometry);
    scope.ownMaterial(material);
    scope.ownMaterial(material);
    scope.ownTexture(texture);
    scope.ownImageBitmap(bitmap);
    scope.ownImageBitmap(bitmap);
    scope.defer(() => events.push('scene'), 'after-resources');
    scope.dispose();
    scope.dispose();
    expect(scope.disposed).toBe(true);
    expect(scope.signal.aborted).toBe(true);
    expect(events).toEqual([
      'abort',
      'controls',
      'geometry',
      'material',
      'texture',
      'bitmap',
      'scene',
      'lists',
      'renderer',
      'context',
      'canvas',
    ]);
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
  });

  it('immediately releases late GLTF resources, late callbacks and observers, exactly once', () => {
    const scope = createViewerLifetime();
    scope.dispose();
    const cleanup = vi.fn();
    const stop = scope.defer(cleanup);
    stop();
    const geometry = { dispose: vi.fn() };
    const texture = { isTexture: true as const, dispose: vi.fn() };
    const material = { map: texture, dispose: vi.fn() };
    const observer = { disconnect: vi.fn() };
    scope.own(geometry);
    scope.own(geometry);
    scope.release(geometry);
    scope.ownMaterial(material);
    scope.ownMaterial(material);
    scope.observe(observer);
    scope.observe(observer);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
    expect(texture.dispose).toHaveBeenCalledTimes(1);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    const renderer = {
      renderLists: { dispose: vi.fn() },
      dispose: vi.fn(),
      forceContextLoss: vi.fn(),
      domElement: { remove: vi.fn() },
    };
    scope.ownRenderer(renderer);
    scope.ownRenderer(renderer);
    expect(renderer.renderLists.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(renderer.domElement.remove).toHaveBeenCalledTimes(1);
  });

  it('drains all releases even after multiple failures and keeps disposal idempotent', () => {
    const scope = createViewerLifetime();
    const end = vi.fn();
    const bad = vi.fn(() => {
      throw new Error('driver failure');
    });
    scope.defer(bad);
    scope.own({ dispose: bad });
    scope.ownRenderer({
      renderLists: { dispose: bad },
      dispose: bad,
      forceContextLoss: bad,
      domElement: { remove: end },
    });
    expect(() => scope.dispose()).toThrow(AggregateError);
    expect(bad).toHaveBeenCalledTimes(5);
    expect(end).toHaveBeenCalledTimes(1);
    expect(scope.signal.aborted).toBe(true);
    expect(() => scope.dispose()).not.toThrow();
  });

  it('drains dependencies and native release when late registrations fail or mutate their dependencies', () => {
    const scope = createViewerLifetime();
    scope.dispose();
    const bad = vi.fn(() => {
      throw new Error('late driver failure');
    });
    const texture = { isTexture: true as const, dispose: bad };
    const secondTexture = { isTexture: true as const, dispose: vi.fn() };
    const material = {
      map: texture as typeof texture | null,
      uniforms: { value: secondTexture },
      dispose: vi.fn(() => {
        material.map = null;
        throw new Error('material failure');
      }),
    };
    expect(() => scope.ownMaterial(material)).toThrow(AggregateError);
    expect(texture.dispose).toHaveBeenCalledTimes(1);
    expect(secondTexture.dispose).toHaveBeenCalledTimes(1);
    expect(() => scope.ownMaterial(material)).not.toThrow();
    const renderer = {
      renderLists: { dispose: bad },
      dispose: bad,
      forceContextLoss: vi.fn(),
      domElement: { remove: vi.fn() },
    };
    expect(() => scope.ownRenderer(renderer)).toThrow(AggregateError);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(renderer.domElement.remove).toHaveBeenCalledTimes(1);
    expect(() => scope.ownRenderer(renderer)).not.toThrow();
    expect(bad).toHaveBeenCalledTimes(3);
  });

  it('supports early release and cyclic shader uniform data without duplicate disposal', () => {
    const scope = createViewerLifetime();
    const target = { dispose: vi.fn() };
    const texture = { isTexture: true as const, dispose: vi.fn() };
    const material = { uniforms: {} as Record<string, unknown>, dispose: vi.fn() };
    material.uniforms.self = material;
    material.uniforms.samples = [texture, texture];
    scope.own(target);
    scope.release(target);
    scope.release(target);
    scope.ownMaterial(material);
    scope.dispose();
    expect(target.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
    expect(texture.dispose).toHaveBeenCalledTimes(1);
  });

  it('removes capture listeners, disconnects observers and refuses late listeners', () => {
    const scope = createViewerLifetime();
    const target = new EventTarget();
    const listener = vi.fn();
    const remove = vi.spyOn(target, 'removeEventListener');
    scope.listen(target, 'sample', listener, { capture: true });
    target.dispatchEvent(new Event('sample'));
    expect(listener).toHaveBeenCalledTimes(1);
    const observer = { disconnect: vi.fn() };
    scope.observe(observer);
    scope.dispose();
    target.dispatchEvent(new Event('sample'));
    expect(remove).toHaveBeenCalledWith('sample', listener, { capture: true });
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    const add = vi.spyOn(target, 'addEventListener');
    scope.listen(target, 'late', listener);
    expect(add).not.toHaveBeenCalled();
  });

  it('owns frames, timers and idle work, drops completed handles and suppresses callbacks after disposal', () => {
    vi.useFakeTimers();
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    const cancelled = vi.fn((id: number) => frames.delete(id));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', cancelled);
    const idle = new Map<number, IdleRequestCallback>();
    let idleId = 0;
    const cancelIdle = vi.fn((id: number) => idle.delete(id));
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      idle.set(++idleId, callback);
      return idleId;
    });
    vi.stubGlobal('cancelIdleCallback', cancelIdle);
    const scope = createViewerLifetime();
    const run = vi.fn();
    const completed = scope.frame(run);
    frames.get(completed)!(16);
    frames.delete(completed);
    const pending = scope.frame(run);
    const queuedFrame = frames.get(pending)!;
    const idleHandle = scope.idle(run);
    const queuedIdle = idle.get(idleHandle)!;
    scope.timeout(run, 100);
    scope.dispose();
    queuedFrame(32);
    queuedIdle({ didTimeout: false, timeRemaining: () => 1 });
    vi.runAllTimers();
    expect(run).toHaveBeenCalledTimes(1);
    expect(cancelled).toHaveBeenCalledExactlyOnceWith(pending);
    expect(cancelIdle).toHaveBeenCalledTimes(1);
    expect(scope.frame(run)).toBe(0);
    expect(scope.timeout(run, 1)).toBeNull();
    expect(scope.idle(run)).toBe(0);
  });

  it('cancels idle fallback and allows explicit cancellation before disposal', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const scope = createViewerLifetime();
    const run = vi.fn();
    const id = scope.timeout(run, 20)!;
    scope.cancelTimeout(id);
    scope.cancelTimeout(id);
    const idle = scope.idle(run);
    scope.cancelIdle(idle);
    scope.cancelIdle(idle);
    scope.idle(run);
    scope.dispose();
    vi.runAllTimers();
    expect(run).not.toHaveBeenCalled();
  });
});

function viewerFixture() {
  const document = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', { devicePixelRatio: 1, matchMedia: () => ({ matches: false }) });
  const frames = new Map<number, FrameRequestCallback>();
  let serial = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++serial, callback);
      return serial;
    }),
  );
  const cancelFrame = vi.fn((id: number) => frames.delete(id));
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  const disconnect = vi.fn();
  let resize: ResizeObserverCallback | undefined;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const fetch = vi.fn((_url: string, _options: RequestInit) => new Promise<Response>(() => {}));
  vi.stubGlobal('fetch', fetch);
  const append = vi.fn();
  const container = { clientWidth: 800, clientHeight: 500, append } as unknown as HTMLElement;
  const onReady = vi.fn();
  const onError = vi.fn();
  const options = {
    container,
    label: 'fixture',
    onReady,
    onError,
    onSelect: vi.fn(),
    onProject: vi.fn(),
  };
  return {
    document,
    frames,
    cancelFrame,
    disconnect,
    fetch,
    append,
    options,
    resize: () => resize?.([], {} as ResizeObserver),
  };
}

function parsedScene() {
  const geometry = new BoxGeometry(0.1, 0.01, 0.1);
  const texture = new Texture();
  const material = new MeshStandardMaterial({ map: texture });
  const mesh = new Mesh(geometry, material);
  mesh.userData.partId = 'busbar';
  const scene = new Group();
  scene.add(mesh);
  const disposeGeometry = vi.spyOn(geometry, 'dispose');
  const disposeMaterial = vi.spyOn(material, 'dispose');
  const disposeTexture = vi.spyOn(texture, 'dispose');
  return { geometry, material, scene, disposeGeometry, disposeMaterial, disposeTexture };
}

function modelResponses(fixture: ReturnType<typeof viewerFixture>) {
  fixture.fetch.mockImplementation(
    async (url) =>
      ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(0),
        json: async () => ({
          units: 'm',
          upAxis: 'Y',
          parts: [],
          parameters: { busbarGapMm: 0.5 },
        }),
        url,
      }) as Response,
  );
}

function rendererFixture() {
  return vi.mocked(WebGLRenderer).mock.results.at(-1)!.value as WebGLRenderer;
}

describe('L1 viewer lifetime integration', () => {
  it('aborts both asset requests and releases frames, actual OrbitControls listeners, observers and context', () => {
    const fixture = viewerFixture();
    const remove = vi.spyOn(fixture.document, 'removeEventListener');
    const viewer = createHalfBridgeViewer(fixture.options);
    const renderer = rendererFixture();
    const canvasRemove = vi.spyOn(renderer.domElement, 'removeEventListener');
    expect(fixture.fetch).toHaveBeenCalledTimes(2);
    const signals = fixture.fetch.mock.calls.map(([, options]) => options.signal!);
    expect(signals[0]).toBe(signals[1]);
    expect(signals[0]!.aborted).toBe(false);
    expect(fixture.frames.size).toBe(1);
    viewer.dispose();
    viewer.dispose();
    fixture.resize();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(fixture.cancelFrame).toHaveBeenCalledTimes(1);
    expect(fixture.disconnect).toHaveBeenCalledTimes(1);
    expect(canvasRemove.mock.calls.some(([type]) => type === 'wheel')).toBe(true);
    expect(remove.mock.calls.some(([type]) => type === 'keydown')).toBe(true);
    expect(renderer.setSize).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(renderer.domElement.remove).toHaveBeenCalledTimes(1);
    expect(viewer.getDiagnostics()).toMatchObject({
      disposed: true,
      scheduledFrame: false,
      controlsDisposed: true,
      ownedListeners: 0,
      meshCount: 0,
      geometryCount: 0,
      rendererInfo: { contextLost: true },
    });
  });

  it('releases the renderer when canvas attachment fails during construction', () => {
    const fixture = viewerFixture();
    fixture.append.mockImplementation(() => {
      throw new Error('detached container');
    });
    expect(() => createHalfBridgeViewer(fixture.options)).toThrow('detached container');
    const renderer = rendererFixture();
    expect(renderer.renderLists.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(renderer.domElement.remove).toHaveBeenCalledTimes(1);
    expect(fixture.fetch).not.toHaveBeenCalled();
  });

  it('releases all late decoded scenes even if the first decoded geometry fails to dispose', async () => {
    const fixture = viewerFixture();
    modelResponses(fixture);
    const decoded = parsedScene();
    const unused = parsedScene();
    decoded.disposeGeometry.mockImplementation(() => {
      throw new Error('late geometry failure');
    });
    let resolveParse!: (value: GLTF) => void;
    const parse = vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(
      () =>
        new Promise<GLTF>((resolve) => {
          resolveParse = resolve;
        }),
    );
    const viewer = createHalfBridgeViewer(fixture.options);
    await vi.waitFor(() => expect(parse).toHaveBeenCalledTimes(1));
    viewer.dispose();
    resolveParse({ scene: decoded.scene, scenes: [decoded.scene, unused.scene] } as GLTF);
    await vi.waitFor(() => expect(unused.disposeTexture).toHaveBeenCalledTimes(1));
    for (const item of [decoded, unused]) {
      expect(item.disposeGeometry).toHaveBeenCalledTimes(1);
      expect(item.disposeMaterial).toHaveBeenCalledTimes(1);
      expect(item.disposeTexture).toHaveBeenCalledTimes(1);
    }
    expect(fixture.options.onReady).not.toHaveBeenCalled();
    expect(fixture.options.onError).not.toHaveBeenCalled();
    expect(fixture.append).toHaveBeenCalledTimes(1);
    expect(fixture.frames.size).toBe(0);
  });

  it('releases originals and partially cloned resources if model adoption fails', async () => {
    const fixture = viewerFixture();
    modelResponses(fixture);
    const decoded = parsedScene();
    const clonedGeometry = decoded.geometry.clone();
    const disposeClone = vi.spyOn(clonedGeometry, 'dispose');
    vi.spyOn(decoded.geometry, 'clone').mockReturnValue(clonedGeometry);
    vi.spyOn(decoded.material, 'clone').mockImplementation(() => {
      throw new Error('clone failure');
    });
    vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue({
      scene: decoded.scene,
      scenes: [decoded.scene],
    } as GLTF);
    const viewer = createHalfBridgeViewer(fixture.options);
    await vi.waitFor(() => expect(fixture.options.onError).toHaveBeenCalledTimes(1));
    expect(decoded.disposeGeometry).toHaveBeenCalledTimes(1);
    expect(decoded.disposeMaterial).toHaveBeenCalledTimes(1);
    expect(decoded.disposeTexture).toHaveBeenCalledTimes(1);
    expect(disposeClone).toHaveBeenCalledTimes(1);
    expect(rendererFixture().forceContextLoss).toHaveBeenCalledTimes(1);
    expect(fixture.options.onReady).not.toHaveBeenCalled();
    expect(viewer.getDiagnostics().disposed).toBe(true);
    viewer.dispose();
    expect(disposeClone).toHaveBeenCalledTimes(1);
  });
});
