/** Per-viewer ownership. Register acquired resources before the next operation can fail. */
type Disposable = { dispose(): void };
type TextureResource = Disposable & { isTexture: true };
type RendererResource = Disposable & {
  renderLists: Disposable;
  forceContextLoss(): void;
  domElement: { remove(): void };
};
type Phase = 'cleanup' | 'resources' | 'textures' | 'images' | 'after-resources' | 'renderer';
type Cleanup = () => void;

function finishAll(callbacks: Iterable<Cleanup>) {
  const errors: unknown[] = [];
  for (const callback of callbacks) {
    try {
      callback();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, 'Viewer cleanup failed');
}

export function createViewerLifetime() {
  const controller = new AbortController();
  let disposed = false;
  const phases: Record<Phase, Set<Cleanup>> = {
    cleanup: new Set(),
    resources: new Set(),
    textures: new Set(),
    images: new Set(),
    'after-resources': new Set(),
    renderer: new Set(),
  };
  const resources = new WeakMap<object, Cleanup>();
  const frames = new Set<number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const idleJobs = new Map<number, Cleanup>();
  let idleSerial = 0;

  function enqueue(cleanup: Cleanup, phase: Phase) {
    let pending = true;
    const release = () => {
      if (!pending) return;
      pending = false;
      phases[phase].delete(release);
      cleanup();
    };
    if (disposed) release();
    else phases[phase].add(release);
    return release;
  }
  function register<T extends object>(resource: T, cleanup: Cleanup, phase: Phase): T {
    if (resources.has(resource)) return resource;
    // Install the once-guard before executing a late cleanup: cleanup may reenter.
    let release: Cleanup = () => {};
    resources.set(resource, () => release());
    release = enqueue(cleanup, phase);
    return resource;
  }
  function own<T extends Disposable>(resource: T): T {
    return register(resource, () => resource.dispose(), 'resources');
  }
  function ownTexture<T extends TextureResource>(texture: T): T {
    return register(texture, () => texture.dispose(), 'textures');
  }
  function ownMaterial<T extends Disposable>(material: T): T {
    const ownedTextures = new Set<TextureResource>();
    const visited = new WeakSet<object>();
    function textures(value: unknown) {
      if (!value || typeof value !== 'object' || visited.has(value)) return;
      visited.add(value);
      if (
        'isTexture' in value &&
        value.isTexture === true &&
        'dispose' in value &&
        typeof value.dispose === 'function'
      ) {
        ownedTextures.add(value as TextureResource);
        return;
      }
      // Also covers ShaderMaterial uniform records/arrays and cycles in user data.
      for (const entry of Object.values(value)) textures(entry);
    }
    textures(material);
    // Discover dependencies before a late material.dispose() can mutate them.
    // One failing release must not strand the remaining decoded textures.
    finishAll([
      () => {
        own(material);
      },
      ...Array.from(ownedTextures, (texture) => () => {
        ownTexture(texture);
      }),
    ]);
    return material;
  }
  function cancelFrame(id: number) {
    if (frames.delete(id)) cancelAnimationFrame(id);
  }
  function cancelTimeout(id: ReturnType<typeof setTimeout>) {
    if (timers.delete(id)) clearTimeout(id);
  }
  function cancelIdle(id: number) {
    const cancel = idleJobs.get(id);
    idleJobs.delete(id);
    cancel?.();
  }
  enqueue(
    () =>
      finishAll([
        ...Array.from(frames, (id) => () => cancelFrame(id)),
        ...Array.from(timers, (id) => () => cancelTimeout(id)),
        ...Array.from(idleJobs.keys(), (id) => () => cancelIdle(id)),
      ]),
    'cleanup',
  );

  return {
    get disposed() {
      return disposed;
    },
    signal: controller.signal,
    defer(cleanup: Cleanup, phase: 'cleanup' | 'after-resources' = 'cleanup') {
      return enqueue(cleanup, phase);
    },
    own,
    ownTexture,
    ownMaterial,
    /** Render targets and controls with dispose() can be owned with own(). */
    release(resource: object) {
      resources.get(resource)?.();
    },
    /** Only register image bitmaps this viewer owns; textures can share external images. */
    ownImageBitmap<T extends { close(): void }>(bitmap: T): T {
      return register(bitmap, () => bitmap.close(), 'images');
    },
    observe<T extends { disconnect(): void }>(observer: T): T {
      return register(observer, () => observer.disconnect(), 'cleanup');
    },
    listen(
      target: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
    ) {
      if (disposed) return () => {};
      target.addEventListener(type, listener, options);
      const capture = typeof options === 'boolean' ? options : (options?.capture ?? false);
      return enqueue(() => target.removeEventListener(type, listener, { capture }), 'cleanup');
    },
    frame(callback: FrameRequestCallback) {
      if (disposed) return 0;
      const id = requestAnimationFrame((time) => {
        frames.delete(id);
        if (!disposed) callback(time);
      });
      frames.add(id);
      return id;
    },
    cancelFrame,
    timeout(callback: Cleanup, delay: number) {
      if (disposed) return null;
      const id = setTimeout(() => {
        timers.delete(id);
        if (!disposed) callback();
      }, delay);
      timers.add(id);
      return id;
    },
    cancelTimeout,
    idle(callback: IdleRequestCallback, options?: IdleRequestOptions) {
      if (disposed) return 0;
      const id = ++idleSerial;
      const run = (deadline: IdleDeadline) => {
        idleJobs.delete(id);
        if (!disposed) callback(deadline);
      };
      if (typeof requestIdleCallback === 'function') {
        const handle = requestIdleCallback(run, options);
        idleJobs.set(id, () => cancelIdleCallback(handle));
      } else {
        const handle = setTimeout(() => run({ didTimeout: false, timeRemaining: () => 0 }), 0);
        idleJobs.set(id, () => clearTimeout(handle));
      }
      return id;
    },
    cancelIdle,
    ownRenderer<T extends RendererResource>(renderer: T): T {
      finishAll([
        () => {
          register(renderer.renderLists, () => renderer.renderLists.dispose(), 'renderer');
        },
        () => {
          register(
            renderer,
            () =>
              finishAll([
                () => renderer.dispose(),
                () => renderer.forceContextLoss(),
                () => renderer.domElement.remove(),
              ]),
            'renderer',
          );
        },
      ]);
      return renderer;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      // Failures never prevent later release phases or native-context destruction.
      finishAll([
        () => controller.abort(),
        ...Object.values(phases).map((phase) => () => finishAll(phase)),
      ]);
    },
  };
}

export type ViewerLifetime = ReturnType<typeof createViewerLifetime>;
