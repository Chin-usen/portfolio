/** Let readable server-rendered content paint before automatic WebGL enhancement.
 * Direct input bypasses this scheduler at its call site. No artificial time delay is used.
 */
export function scheduleVisibleEnhancement(
  callback: () => void,
  options: { signal: AbortSignal; preview?: HTMLImageElement | null },
): () => void {
  const { signal, preview } = options;
  let cancelled = false;
  let frame: number | undefined;
  let idle: number | undefined;
  let timer: number | undefined;
  let paintObserver: PerformanceObserver | undefined;
  function cancel() {
    if (cancelled) return;
    cancelled = true;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    if (idle !== undefined) window.cancelIdleCallback(idle);
    if (timer !== undefined) window.clearTimeout(timer);
    paintObserver?.disconnect();
    signal.removeEventListener('abort', cancel);
  }
  if (signal.aborted) {
    cancelled = true;
    return cancel;
  }
  signal.addEventListener('abort', cancel, { once: true });
  const firstPaint = new Promise<void>((resolve) => {
    // A client-side route change already has a document FCP. Its fresh content/image
    // still receives the two rendering opportunities below before enhancement.
    if (
      window.performance?.getEntriesByName('first-contentful-paint').length ||
      typeof PerformanceObserver === 'undefined' ||
      !PerformanceObserver.supportedEntryTypes?.includes('paint')
    ) {
      resolve();
      return;
    }
    try {
      paintObserver = new PerformanceObserver((entries) => {
        if (!entries.getEntries().some((entry) => entry.name === 'first-contentful-paint')) return;
        paintObserver?.disconnect();
        paintObserver = undefined;
        resolve();
      });
      paintObserver.observe({ type: 'paint', buffered: true });
    } catch {
      // Paint Timing is optional. Rendering frames remain the portable fallback.
      paintObserver?.disconnect();
      paintObserver = undefined;
      resolve();
    }
  });
  const decoded = Promise.resolve().then(() => preview?.decode?.());
  void Promise.allSettled([document.fonts?.ready, decoded, firstPaint]).then(() => {
    if (cancelled) return;
    frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        if (cancelled) return;
        const run = () => {
          if (cancelled) return;
          cancel();
          callback();
        };
        if (typeof window.requestIdleCallback === 'function')
          idle = window.requestIdleCallback(run, { timeout: 1500 });
        else timer = window.setTimeout(run, 0);
      });
    });
  });
  return cancel;
}
