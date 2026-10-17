import {
  Color,
  DirectionalLight,
  HemisphereLight,
  NoToneMapping,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Spherical,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createViewerLifetime } from '../_shared/viewer-lifetime';
import { createPinFinAssembly, PART_IDS, type PartId, type PinFinAssembly } from './geometry';
import type { PinFinParams } from './parameters';

export interface PinFinViewerOptions {
  container: HTMLElement;
  label: string;
  onSelect?: (id: PartId | null) => void;
  onError?: () => void;
}

export interface PinFinViewerDiagnostics {
  disposed: boolean;
  renderCount: number;
  rebuildCount: number;
  pinCount: number;
  scheduledFrame: boolean;
  selectedId: PartId | null;
  coverVisible: boolean;
  controlsDisposed: boolean;
  rendererInfo: {
    geometries: number;
    textures: number;
    programs: number;
    contextLost: boolean;
  };
}

export interface PinFinViewer {
  update(params: PinFinParams): void;
  setSelected(id: PartId | null): void;
  setCover(visible: boolean): void;
  reset(): void;
  dispose(): void;
  getDiagnostics(): PinFinViewerDiagnostics;
}

const isPart = (value: unknown): value is PartId =>
  typeof value === 'string' && (PART_IDS as readonly string[]).includes(value);

/** Parametric WebGL view. Geometry is rebuilt from the same source as the committed GLB. */
export function createPinFinViewer(options: PinFinViewerOptions): PinFinViewer {
  const { container } = options;
  const life = createViewerLifetime();
  const canvas = document.createElement('canvas');
  const renderer = life.ownRenderer(
    new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }),
  );
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', options.label);
  canvas.dataset.pfWebgl = 'true';
  container.append(canvas);

  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x8a8f99, 2.1));
  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(-60, 120, 80);
  scene.add(key);
  const fill = new DirectionalLight(0xdde8ff, 0.9);
  fill.position.set(80, 40, -60);
  scene.add(fill);
  const camera = new PerspectiveCamera(32, 1, 1, 2000);
  const controls = life.own(new OrbitControls(camera, canvas));
  let controlsDisposed = false;
  life.defer(() => {
    controlsDisposed = true;
  }, 'after-resources');
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 60;
  controls.maxDistance = 600;
  controls.maxPolarAngle = Math.PI * 0.49;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const highlight = new Color(0x66b7ff);

  let assembly: PinFinAssembly | null = null;
  // three's shared DFG lookup texture for PBR lights is bound per renderer; release it here.
  const uniformSets = new Set<Record<string, { value: unknown }>>();
  life.defer(() => {
    for (const uniforms of uniformSets) {
      const lut = uniforms.dfgLUT?.value as { dispose?: () => void } | undefined;
      lut?.dispose?.();
    }
    uniformSets.clear();
  }, 'cleanup');
  let latest: PinFinParams | null = null;
  let dirty = false;
  let selected: PartId | null = null;
  let coverVisible = true;
  let raf = 0;
  let renderCount = 0;
  let rebuildCount = 0;
  let span = 120;
  let contextLost = false;

  function invalidate() {
    if (!raf && !life.disposed && !document.hidden) raf = life.frame(render);
  }
  function applySelection() {
    if (!assembly) return;
    for (const part of assembly.parts) {
      const material = part.mesh.material;
      material.emissive.copy(part.id === selected ? highlight : new Color(0x000000));
      material.emissiveIntensity = part.id === selected ? 0.35 : 0;
      if (part.id === 'cover') part.mesh.visible = coverVisible;
    }
  }
  function rebuild() {
    if (!latest) return;
    assembly?.dispose();
    if (assembly) scene.remove(assembly.group);
    assembly = createPinFinAssembly(latest, { instanced: true, radialSegments: 16 });
    for (const part of assembly.parts)
      part.mesh.material.onBeforeCompile = (shader) => {
        uniformSets.add(shader.uniforms);
      };
    scene.add(assembly.group);
    rebuildCount += 1;
    const nextSpan = Math.max(latest.length + 40, latest.width + 10);
    const first = rebuildCount === 1;
    span = nextSpan;
    if (first) reset();
    applySelection();
    dirty = false;
  }
  function render() {
    raf = 0;
    if (life.disposed) return;
    if (dirty) rebuild();
    renderer.render(scene, camera);
    renderCount += 1;
  }
  function reset() {
    const aspect = Math.max(0.5, container.clientWidth / Math.max(1, container.clientHeight));
    const distance = (span * 1.75) / Math.min(1.2, aspect);
    camera.position.copy(new Vector3(-0.8, 1.15, 1.05).normalize().multiplyScalar(distance));
    controls.target.set(0, 3, 0);
    controls.update();
    invalidate();
  }
  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }
  function pick(event: PointerEvent): PartId | null {
    if (!assembly) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const targets: Object3D[] = assembly.parts
      .filter((part) => part.mesh.visible)
      .map((part) => part.mesh);
    const hit = raycaster.intersectObjects(targets, false)[0];
    const id = hit?.object.userData.partId;
    return isPart(id) ? id : null;
  }
  let down: { x: number; y: number; id: number } | null = null;
  life.listen(canvas, 'pointerdown', (event) => {
    const e = event as PointerEvent;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  life.listen(canvas, 'pointerup', (event) => {
    const e = event as PointerEvent;
    const start = down;
    down = null;
    if (
      !start ||
      start.id !== e.pointerId ||
      Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6
    )
      return;
    selected = pick(e);
    applySelection();
    options.onSelect?.(selected);
    invalidate();
  });
  life.listen(canvas, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Home') {
      e.preventDefault();
      reset();
      return;
    }
    const spherical = new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const step = Math.PI / 24;
    if (e.key === 'ArrowLeft') spherical.theta += step;
    else if (e.key === 'ArrowRight') spherical.theta -= step;
    else if (e.key === 'ArrowUp') spherical.phi -= step;
    else if (e.key === 'ArrowDown') spherical.phi += step;
    else if (e.key === '+' || e.key === '=') spherical.radius *= 0.9;
    else if (e.key === '-' || e.key === '_') spherical.radius /= 0.9;
    else return;
    e.preventDefault();
    spherical.phi = Math.min(controls.maxPolarAngle, Math.max(0.1, spherical.phi));
    spherical.radius = Math.min(
      controls.maxDistance,
      Math.max(controls.minDistance, spherical.radius),
    );
    camera.position.setFromSpherical(spherical).add(controls.target);
    controls.update();
    invalidate();
  });
  life.listen(canvas, 'webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    queueMicrotask(() => options.onError?.());
  });
  life.listen(document, 'visibilitychange', () => {
    if (!document.hidden) invalidate();
  });
  controls.addEventListener('change', invalidate);
  life.defer(() => controls.removeEventListener('change', invalidate));
  const observer = life.observe(new ResizeObserver(resize));
  observer.observe(container);
  life.defer(() => {
    assembly?.dispose();
    assembly = null;
  }, 'cleanup');
  resize();

  return {
    update(params) {
      latest = { ...params };
      dirty = true;
      invalidate();
    },
    setSelected(id) {
      selected = id;
      applySelection();
      invalidate();
    },
    setCover(visible) {
      coverVisible = visible;
      applySelection();
      invalidate();
    },
    reset,
    dispose() {
      raf = 0;
      life.dispose();
    },
    getDiagnostics() {
      return {
        disposed: life.disposed,
        renderCount,
        rebuildCount,
        pinCount: assembly?.pinCount ?? 0,
        scheduledFrame: raf !== 0,
        selectedId: selected,
        coverVisible,
        controlsDisposed,
        rendererInfo: {
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0,
          contextLost: contextLost || renderer.getContext().isContextLost(),
        },
      };
    },
  };
}
