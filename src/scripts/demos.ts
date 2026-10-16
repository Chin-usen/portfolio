type DemoKind = 'three' | 'animation' | 'lenis';
type Cleanup = () => void;
type Labels = Record<string, string>;
interface DemoContext {
  labels: Labels;
  reducedMotion: boolean;
  current: () => boolean;
}

async function createThree(stage: HTMLElement, context: DemoContext): Promise<Cleanup> {
  const THREE = await import('three');
  if (!context.current()) return () => {};
  // Pending or failed imports must not retain a WebGL context after reset/navigation.
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
  if (!gl) throw new Error('WEBGL_UNAVAILABLE');
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 30);
  camera.position.set(3, 2, 4);
  camera.lookAt(0, 0, 0);
  const geometry = new THREE.BoxGeometry(1.3, 1.3, 1.3);
  const material = new THREE.MeshNormalMaterial();
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', context.labels.three ?? 'Three.js');
  stage.append(canvas);
  const render = () => renderer.render(scene, camera);
  const resize = () => {
    const width = Math.max(stage.clientWidth, 1);
    const height = 320;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  let frame = 0;
  const started = performance.now();
  const animate = (time: number) => {
    if (!context.current() || document.hidden) return;
    const progress = Math.min((time - started) / 1600, 1);
    cube.rotation.y = progress * Math.PI * 1.5;
    cube.rotation.x = progress * Math.PI * 0.2;
    render();
    if (progress < 1) frame = requestAnimationFrame(animate);
  };
  if (!context.reducedMotion) frame = requestAnimationFrame(animate);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}

async function createAnimation(stage: HTMLElement, context: DemoContext): Promise<Cleanup> {
  const track = document.createElement('div');
  track.className = 'demo-motion-track';
  const box = document.createElement('div');
  box.className = 'demo-motion-box';
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', context.labels.animation ?? 'Animation experiment');
  track.append(box);
  stage.append(track);
  const distance = Math.max(stage.clientWidth - 82, 0);
  if (context.reducedMotion) {
    box.style.transform = `translateX(${distance}px)`;
    return () => {};
  }
  if (!context.current()) return () => {};
  const animation = box.animate(
    [
      { transform: 'translateX(0) rotate(0deg)' },
      { transform: `translateX(${distance}px) rotate(180deg)` },
    ],
    { duration: 1400, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' },
  );
  return () => {
    animation.cancel();
  };
}

async function createLenis(stage: HTMLElement, context: DemoContext): Promise<Cleanup> {
  const wrapper = document.createElement('div');
  wrapper.className = 'demo-scroll-wrapper';
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', context.labels.lenis ?? 'Lenis');
  const content = document.createElement('div');
  content.className = 'demo-scroll-content';
  for (let index = 1; index <= 5; index += 1) {
    const paragraph = document.createElement('p');
    paragraph.textContent = `${context.labels.scrollTarget ?? ''} ${index}`;
    content.append(paragraph);
  }
  wrapper.append(content);
  stage.append(wrapper);
  if (context.reducedMotion) {
    wrapper.scrollTop = wrapper.scrollHeight;
    return () => {};
  }
  const { default: Lenis } = await import('lenis');
  if (!context.current()) return () => {};
  const lenis = new Lenis({ wrapper, content, autoRaf: false, smoothWheel: false });
  let frame = 0;
  let finished = false;
  const started = performance.now();
  const raf = (time: number) => {
    if (!context.current() || document.hidden) return;
    lenis.raf(time);
    if (!finished && time - started < 2200) frame = requestAnimationFrame(raf);
  };
  lenis.scrollTo(wrapper.scrollHeight, {
    duration: 1.4,
    onComplete: () => {
      finished = true;
    },
  });
  frame = requestAnimationFrame(raf);
  return () => {
    cancelAnimationFrame(frame);
    lenis.destroy();
  };
}

export function initializeDemos(panel: HTMLElement): Cleanup {
  const stage = panel.querySelector<HTMLElement>('[data-testid="demo-stage"]');
  const status = panel.querySelector<HTMLElement>('[data-testid="demo-status"]');
  if (!stage || !status) return () => {};
  const labels = JSON.parse(panel.dataset.labels ?? '{}') as Labels;
  const buttons = [...panel.querySelectorAll<HTMLButtonElement>('[data-demo]')];
  const reset = panel.querySelector<HTMLButtonElement>('[data-demo-reset]');
  const events = new AbortController();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let generation = 0;
  let cleanup: Cleanup = () => {};
  const clear = () => {
    generation += 1;
    cleanup();
    cleanup = () => {};
    stage.replaceChildren();
    status.textContent = '';
    buttons.forEach((button) => {
      button.disabled = false;
    });
  };
  for (const button of buttons) {
    button.addEventListener(
      'click',
      async () => {
        clear();
        const active = generation;
        const current = () => active === generation;
        const kind = button.dataset.demo as DemoKind;
        status.textContent = labels.loading ?? '';
        buttons.forEach((control) => {
          control.disabled = true;
        });
        try {
          const context = { labels, reducedMotion: motion.matches, current };
          const destroy =
            kind === 'three'
              ? await createThree(stage, context)
              : kind === 'animation'
                ? await createAnimation(stage, context)
                : await createLenis(stage, context);
          if (!current()) {
            destroy();
            return;
          }
          cleanup = destroy;
          status.textContent = motion.matches
            ? (labels.reducedMotion ?? '')
            : (labels.complete ?? '');
        } catch (error) {
          if (!current()) return;
          stage.replaceChildren();
          status.textContent =
            error instanceof Error && error.message === 'WEBGL_UNAVAILABLE'
              ? (labels.unsupported ?? '')
              : (labels.error ?? '');
        } finally {
          if (current())
            buttons.forEach((control) => {
              control.disabled = false;
            });
        }
      },
      { signal: events.signal },
    );
  }
  reset?.addEventListener('click', clear, { signal: events.signal });
  window.addEventListener('pagehide', clear, { signal: events.signal });
  motion.addEventListener('change', clear, { signal: events.signal });
  return () => {
    clear();
    events.abort();
  };
}
