import { afterEach, expect, it, vi } from 'vitest';
import { scheduleVisibleEnhancement } from '../../src/components/lab/_shared/visible-enhancement';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function flush() {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}
function fixture({ buffered = false, supported = true, idle = true } = {}) {
  const fonts = deferred();
  const image = deferred();
  const frames = new Map<number, FrameRequestCallback>();
  const idleJobs = new Map<number, () => void>();
  const timers = new Map<number, () => void>();
  let serial = 0;
  let notify: PerformanceObserverCallback | undefined;
  const disconnected = vi.fn();
  class Observer {
    static supportedEntryTypes = supported ? ['paint'] : [];
    constructor(callback: PerformanceObserverCallback) {
      notify = callback;
    }
    observe = vi.fn();
    disconnect = disconnected;
  }
  vi.stubGlobal('PerformanceObserver', Observer);
  vi.stubGlobal('document', { fonts: { ready: fonts.promise } });
  vi.stubGlobal('window', {
    performance: { getEntriesByName: () => (buffered ? [{ name: 'first-contentful-paint' }] : []) },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++serial, callback);
      return serial;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    requestIdleCallback: idle
      ? (callback: () => void) => {
          idleJobs.set(++serial, callback);
          return serial;
        }
      : undefined,
    cancelIdleCallback: (id: number) => idleJobs.delete(id),
    setTimeout: (callback: () => void) => {
      timers.set(++serial, callback);
      return serial;
    },
    clearTimeout: (id: number) => timers.delete(id),
  });
  function paint() {
    notify?.(
      {
        getEntries: () => [{ name: 'first-contentful-paint' }],
      } as unknown as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    );
  }
  function frame() {
    const job = [...frames.entries()][0];
    expect(job).toBeDefined();
    frames.delete(job![0]);
    job![1](0);
  }
  function runIdle() {
    const jobs = idle ? idleJobs : timers;
    const job = [...jobs.entries()][0];
    expect(job).toBeDefined();
    jobs.delete(job![0]);
    job![1]();
  }
  const abort = new AbortController();
  const callback = vi.fn();
  const preview = { decode: () => image.promise } as unknown as HTMLImageElement;
  return {
    fonts,
    image,
    frames,
    idleJobs,
    timers,
    paint,
    frame,
    runIdle,
    abort,
    callback,
    preview,
    disconnected,
  };
}
afterEach(() => vi.unstubAllGlobals());

it('waits for the visible preview, fonts and actual document paint before yielding frames and idle', async () => {
  const f = fixture();
  scheduleVisibleEnhancement(f.callback, { signal: f.abort.signal, preview: f.preview });
  f.fonts.resolve();
  f.image.resolve();
  await flush();
  expect(f.frames.size).toBe(0);
  f.paint();
  await flush();
  expect(f.frames.size).toBe(1);
  f.frame();
  expect(f.idleJobs.size).toBe(0);
  f.frame();
  expect(f.callback).not.toHaveBeenCalled();
  f.runIdle();
  expect(f.callback).toHaveBeenCalledTimes(1);
  expect(f.disconnected).toHaveBeenCalled();
});

for (const stage of ['readiness', 'first-frame', 'second-frame', 'idle']) {
  it(`aborts at ${stage} without starting a viewer or leaving scheduled callbacks`, async () => {
    const f = fixture();
    scheduleVisibleEnhancement(f.callback, { signal: f.abort.signal, preview: f.preview });
    if (stage !== 'readiness') {
      f.fonts.resolve();
      f.image.resolve();
      f.paint();
      await flush();
    }
    if (stage === 'second-frame' || stage === 'idle') f.frame();
    if (stage === 'idle') f.frame();
    f.abort.abort();
    f.fonts.resolve();
    f.image.resolve();
    f.paint();
    await flush();
    expect(f.frames.size + f.idleJobs.size + f.timers.size).toBe(0);
    expect(f.callback).not.toHaveBeenCalled();
    expect(f.disconnected).toHaveBeenCalled();
  });
}

it('uses the existing document paint for client navigation but still waits for the new preview', async () => {
  const f = fixture({ buffered: true });
  scheduleVisibleEnhancement(f.callback, { signal: f.abort.signal, preview: f.preview });
  f.fonts.resolve();
  await flush();
  expect(f.frames.size).toBe(0);
  f.image.resolve();
  await flush();
  f.frame();
  f.frame();
  f.runIdle();
  expect(f.callback).toHaveBeenCalledTimes(1);
});

it('keeps enhancement available when image decoding or optional browser timing APIs fail', async () => {
  const f = fixture({ supported: false, idle: false });
  scheduleVisibleEnhancement(f.callback, {
    signal: f.abort.signal,
    preview: {
      decode: () => Promise.reject(new Error('invalid image')),
    } as unknown as HTMLImageElement,
  });
  f.fonts.resolve();
  await flush();
  f.frame();
  f.frame();
  expect(f.timers.size).toBe(1);
  f.runIdle();
  expect(f.callback).toHaveBeenCalledTimes(1);
});

it('allows direct interaction to cancel automatic readiness without a late duplicate', async () => {
  const f = fixture();
  const cancel = scheduleVisibleEnhancement(f.callback, {
    signal: f.abort.signal,
    preview: f.preview,
  });
  cancel();
  f.fonts.resolve();
  f.image.resolve();
  f.paint();
  await flush();
  expect(f.frames.size).toBe(0);
  expect(f.callback).not.toHaveBeenCalled();
});
