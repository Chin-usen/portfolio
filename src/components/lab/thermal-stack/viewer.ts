import {
  BoxGeometry,
  BufferAttribute,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Spherical,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  DynamicDrawUsage,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { sampleTemperature } from './field-sampler';
import type { ThermalLayerId, ThermalParams, ThermalResult } from './types';
import {
  easedProgress,
  layoutLayers,
  LINEAR_PALETTE,
  paletteIndex,
  type DisplayLayer,
  type ThermalViewer,
  type ThermalViewerOptions,
} from './viewer-shared';
import { createFallbackViewer } from './viewer-fallback';

export type {
  ThermalViewer,
  ThermalViewerDiagnostics,
  ThermalViewerOptions,
} from './viewer-shared';

interface LayerMesh {
  id: ThermalLayerId;
  mesh: Mesh<BoxGeometry, MeshBasicMaterial>;
  outline: LineSegments<EdgesGeometry, LineBasicMaterial>;
  fullGeometry: BoxGeometry;
  cutGeometry: BoxGeometry;
  display: DisplayLayer;
}

/** The temperature field is illustrative interpolation, not a finite-element result. */
export function createThermalViewer(options: ThermalViewerOptions): ThermalViewer {
  let delegate: ThermalViewer;
  let latest: { params: ThermalParams; result: ThermalResult } | null = null;
  let cutaway = false;
  let exploded = false;
  let selected: ThermalLayerId | null = null;
  let disposed = false;
  let fallbackActive = false;
  const delegatedOptions: ThermalViewerOptions = {
    ...options,
    onSelect(id) {
      selected = id;
      options.onSelect?.(id);
    },
  };

  const useFallback = (reason: string) => {
    if (disposed || fallbackActive) return;
    fallbackActive = true;
    delegate?.dispose();
    delegate = createFallbackViewer(delegatedOptions);
    if (latest) delegate.update(latest.params, latest.result);
    delegate.setCutaway(cutaway);
    delegate.setExploded(exploded);
    delegate.setSelected(selected);
    options.onError?.(reason);
  };

  try {
    delegate = createWebGLViewer(delegatedOptions, () =>
      useFallback(
        options.labels?.contextLost ??
          'WebGL context was lost; the interactive 2D cross-section is active.',
      ),
    );
  } catch {
    fallbackActive = true;
    delegate = createFallbackViewer(delegatedOptions);
    options.onError?.(
      options.labels?.unavailable ??
        'WebGL is unavailable; the interactive 2D cross-section is active.',
    );
  }

  return {
    update(params, result) {
      if (disposed) return;
      latest = { params: { ...params }, result };
      delegate.update(params, result);
    },
    setCutaway(value) {
      cutaway = value;
      if (!disposed) delegate.setCutaway(value);
    },
    setExploded(value) {
      exploded = value;
      if (!disposed) delegate.setExploded(value);
    },
    setSelected(value) {
      selected = value;
      if (!disposed) delegate.setSelected(value);
    },
    reset() {
      if (!disposed) delegate.reset();
    },
    getDiagnostics() {
      return delegate.getDiagnostics();
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        delegate.dispose();
      }
    },
  };
}

function createWebGLViewer(
  options: ThermalViewerOptions,
  onContextLoss: () => void,
): ThermalViewer {
  const { container, onHover, onSelect } = options;
  const canvas = document.createElement('canvas');
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  canvas.style.cssText =
    'display:block;width:100%;height:100%;touch-action:none;outline-offset:-4px;';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    options.labels?.stage ?? container.getAttribute('aria-label') ?? 'Interactive thermal stack.',
  );
  canvas.dataset.thermalCanvas = 'webgl';
  container.append(canvas);
  container.dataset.thermalRenderer = 'webgl';
  container.setAttribute('role', 'group');

  const scene = new Scene();
  const root = new Group();
  scene.add(root);
  const camera = new PerspectiveCamera(35, 1, 0.1, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 32;
  controls.maxDistance = 145;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI * 0.78;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.75;
  const material = new MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const unitBox = new BoxGeometry(1, 1, 1);
  const halfBox = new BoxGeometry(1, 1, 0.5).translate(0, 0, -0.25);
  const fullEdges = new EdgesGeometry(unitBox);
  const cutEdges = new EdgesGeometry(halfBox);
  unitBox.dispose();
  halfBox.dispose();
  const coarse = window.matchMedia('(pointer: coarse)').matches || container.clientWidth < 600;
  const subdivisions = coarse ? 12 : 22;
  const verticalSubdivisions = coarse ? 4 : 6;
  const meshes = new Map<ThermalLayerId, LayerMesh>();
  const raycastMeshes: Mesh[] = [];
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected: ThermalLayerId | null = null;
  let hovered: ThermalLayerId | null = null;
  let isCutaway = false;
  let isExploded = false;
  let explodeProgress = 0;
  let animateFrom = 0;
  let animateTo = 0;
  let animationStart = 0;
  let animating = false;
  let raf = 0;
  let disposed = false;
  let controlsDisposed = false;
  const listenerCleanup: Array<() => void> = [];
  function listen<T extends Event>(
    target: EventTarget,
    type: string,
    listener: (event: T) => void,
  ) {
    target.addEventListener(type, listener as EventListener);
    listenerCleanup.push(() => target.removeEventListener(type, listener as EventListener));
  }
  let renderCount = 0;
  let lastUpdateMs = 0;
  let latest: { params: ThermalParams; result: ThermalResult } | null = null;
  let dirty = false;
  let pointerDown: {
    x: number;
    y: number;
    pointerId: number;
    moved: boolean;
  } | null = null;

  function invalidate() {
    if (raf === 0 && !disposed && !document.hidden) raf = requestAnimationFrame(render);
  }

  function makeGeometry(cut: boolean) {
    const geometry = new BoxGeometry(
      1,
      1,
      cut ? 0.5 : 1,
      subdivisions,
      verticalSubdivisions,
      subdivisions,
    );
    if (cut) geometry.translate(0, 0, -0.25);
    geometry.setAttribute(
      'color',
      new Float32BufferAttribute(geometry.getAttribute('position').count * 3, 3).setUsage(
        DynamicDrawUsage,
      ),
    );
    return geometry;
  }

  function buildLayer(display: DisplayLayer): LayerMesh {
    const fullGeometry = makeGeometry(false);
    const cutGeometry = makeGeometry(true);
    const mesh = new Mesh(isCutaway ? cutGeometry : fullGeometry, material);
    mesh.name = display.layer.id;
    mesh.userData.layerId = display.layer.id;
    const outline = new LineSegments(
      isCutaway ? cutEdges : fullEdges,
      new LineBasicMaterial({
        color: 0x7b8090,
        transparent: true,
        opacity: 0.45,
        depthTest: true,
        toneMapped: false,
      }),
    );
    mesh.add(outline);
    root.add(mesh);
    const entry = {
      id: display.layer.id,
      mesh,
      outline,
      fullGeometry,
      cutGeometry,
      display,
    };
    meshes.set(entry.id, entry);
    raycastMeshes.push(mesh);
    return entry;
  }

  function updateColors(entry: LayerMesh, params: ThermalParams, result: ThermalResult) {
    const geometry = entry.mesh.geometry;
    const positions = geometry.getAttribute('position');
    const attribute = geometry.getAttribute('color') as BufferAttribute;
    const colors = attribute.array as Float32Array;
    const layer = entry.display.layer;
    for (let index = 0; index < positions.count; index += 1) {
      const chebyshev =
        Math.max(Math.abs(positions.getX(index)), Math.abs(positions.getZ(index))) * layer.width;
      const temperature =
        sampleTemperature(result, layer, positions.getY(index) + 0.5, chebyshev, params.T_cool) ??
        params.T_cool;
      const lut = paletteIndex(temperature, result) * 3;
      colors[index * 3] = LINEAR_PALETTE[lut] ?? 0;
      colors[index * 3 + 1] = LINEAR_PALETTE[lut + 1] ?? 0;
      colors[index * 3 + 2] = LINEAR_PALETTE[lut + 2] ?? 0;
    }
    attribute.needsUpdate = true;
  }

  function applyUpdate() {
    if (!latest) return;
    const start = performance.now();
    const layout = layoutLayers(latest.result.layers);
    for (const display of layout) {
      const entry = meshes.get(display.layer.id) ?? buildLayer(display);
      entry.display = display;
      entry.mesh.scale.set(display.layer.width, display.height, display.layer.width);
      updateColors(entry, latest.params, latest.result);
    }
    lastUpdateMs = performance.now() - start;
    refreshOutlines();
    dirty = false;
  }

  function refreshOutlines() {
    for (const entry of meshes.values()) {
      const focused = entry.id === selected || entry.id === hovered;
      entry.outline.material.color.set(focused ? 0x66b7ff : 0x7b8090);
      entry.outline.material.opacity = focused ? 1 : 0.45;
      entry.outline.renderOrder = focused ? 2 : 1;
    }
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
    for (const entry of meshes.values())
      entry.mesh.position.y = entry.display.center + entry.display.explodeOffset * explodeProgress;
    renderer.render(scene, camera);
    renderCount += 1;
    if (animating) invalidate();
  }

  function reset() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const distance = width / height < 0.95 ? 100 : 72;
    camera.position.copy(new Vector3(0.72, 0.55, 0.83).normalize().multiplyScalar(distance));
    controls.target.set(0, 0, 0);
    controls.update();
    invalidate();
  }

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }

  function hitTest(event: PointerEvent): ThermalLayerId | null {
    if (dirty) applyUpdate();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(raycastMeshes, false)[0];
    return hit ? (hit.object.userData.layerId as ThermalLayerId) : null;
  }

  function setHover(id: ThermalLayerId | null) {
    if (hovered === id) return;
    hovered = id;
    canvas.style.cursor = id ? 'pointer' : 'grab';
    refreshOutlines();
    onHover?.(id);
    invalidate();
  }

  function pointerStart(event: PointerEvent) {
    if (event.button !== 0) return;
    pointerDown = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      moved: false,
    };
  }

  function pointerMove(event: PointerEvent) {
    if (pointerDown) {
      if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 6)
        pointerDown.moved = true;
      if (pointerDown.moved) setHover(null);
      return;
    }
    if (event.pointerType !== 'touch') setHover(hitTest(event));
  }

  function pointerEnd(event: PointerEvent) {
    const start = pointerDown;
    pointerDown = null;
    if (
      !start ||
      start.pointerId !== event.pointerId ||
      start.moved ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6
    )
      return;
    selected = hitTest(event);
    refreshOutlines();
    onSelect?.(selected);
    invalidate();
  }

  function pointerCancel() {
    pointerDown = null;
    setHover(null);
  }
  function pointerLeave() {
    if (!pointerDown) setHover(null);
  }
  function keyboard(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Home') {
      event.preventDefault();
      reset();
      return;
    }
    if (event.key === 'Escape') {
      selected = null;
      refreshOutlines();
      onSelect?.(null);
      invalidate();
      return;
    }

    const orbitStep = Math.PI / 24;
    const zoomStep = 0.9;
    const spherical = new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    switch (event.key) {
      case 'ArrowLeft':
        spherical.theta += orbitStep;
        break;
      case 'ArrowRight':
        spherical.theta -= orbitStep;
        break;
      case 'ArrowUp':
        spherical.phi -= orbitStep;
        break;
      case 'ArrowDown':
        spherical.phi += orbitStep;
        break;
      case '+':
      case '=':
        spherical.radius *= zoomStep;
        break;
      case '-':
      case '_':
        spherical.radius /= zoomStep;
        break;
      default:
        return;
    }
    event.preventDefault();
    spherical.phi = Math.max(
      controls.minPolarAngle,
      Math.min(controls.maxPolarAngle, spherical.phi),
    );
    spherical.radius = Math.max(
      controls.minDistance,
      Math.min(controls.maxDistance, spherical.radius),
    );
    camera.position.setFromSpherical(spherical).add(controls.target);
    controls.update();
    invalidate();
  }
  function contextLost(event: Event) {
    event.preventDefault();
    queueMicrotask(onContextLoss);
  }
  function visibility() {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!document.hidden) invalidate();
  }

  listen(canvas, 'pointerdown', pointerStart);
  listen(canvas, 'pointermove', pointerMove);
  listen(canvas, 'pointerup', pointerEnd);
  listen(canvas, 'pointercancel', pointerCancel);
  listen(canvas, 'pointerleave', pointerLeave);
  listen(canvas, 'dblclick', reset);
  listen(canvas, 'keydown', keyboard);
  listen(canvas, 'webglcontextlost', contextLost);
  listen(document, 'visibilitychange', visibility);
  controls.addEventListener('change', invalidate);
  listenerCleanup.push(() => controls.removeEventListener('change', invalidate));
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  reset();

  return {
    update(params, result) {
      latest = { params: { ...params }, result };
      dirty = true;
      invalidate();
    },
    setCutaway(enabled) {
      if (isCutaway === enabled) return;
      isCutaway = enabled;
      for (const entry of meshes.values()) {
        entry.mesh.geometry = enabled ? entry.cutGeometry : entry.fullGeometry;
        entry.outline.geometry = enabled ? cutEdges : fullEdges;
      }
      dirty = true;
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
      refreshOutlines();
      invalidate();
    },
    reset,
    getDiagnostics() {
      return {
        mode: 'webgl',
        renderCount,
        scheduledFrame: raf !== 0,
        layerCount: meshes.size,
        geometryCount: disposed ? 0 : meshes.size * 2 + 2,
        vertexCount: [...meshes.values()].reduce(
          (sum, entry) => sum + entry.mesh.geometry.getAttribute('position').count,
          0,
        ),
        selectedId: selected,
        hoveredId: hovered,
        cutaway: isCutaway,
        exploded: isExploded,
        explodeProgress,
        lastUpdateMs,
        pixelRatio: renderer.getPixelRatio(),
        disposed,
        rendererInfo: {
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          contextLost: renderer.getContext().isContextLost(),
        },
        ownedListeners: listenerCleanup.length,
        controlsDisposed,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      resizeObserver.disconnect();
      for (const remove of listenerCleanup.splice(0)) remove();
      controls.dispose();
      controlsDisposed = true;
      for (const entry of meshes.values()) {
        entry.fullGeometry.dispose();
        entry.cutGeometry.dispose();
        entry.outline.material.dispose();
      }
      fullEdges.dispose();
      cutEdges.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      meshes.clear();
      raycastMeshes.length = 0;
    },
  };
}
