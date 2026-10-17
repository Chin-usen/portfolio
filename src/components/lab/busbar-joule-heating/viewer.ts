import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
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
  Triangle,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  CONDUCTOR_IDS,
  latticeOffsets,
  type BusbarGeometry,
  type ConductorId,
} from './geometry.ts';
import { createFallbackViewer } from './viewer-fallback.ts';
import {
  boltPlacement,
  buildBoxSurface,
  CAMERA,
  EXPLODE_OFFSET_MM,
  fieldRange,
  PALETTES,
  paletteIndex,
  sampleSurface,
  sectionHeight,
  type BusbarViewer,
  type BusbarViewerOptions,
  type FieldMode,
  type Surface,
  type ViewerState,
} from './viewer-shared.ts';

export type {
  BusbarViewer,
  BusbarViewerDiagnostics,
  BusbarViewerOptions,
} from './viewer-shared.ts';

/** WebGL viewer with an automatic switch to the 2D plan view on failure or context loss. */
export function createBusbarViewer(options: BusbarViewerOptions): BusbarViewer {
  let delegate: BusbarViewer;
  let latest: ViewerState | null = null;
  let mode: FieldMode = 'temperature';
  let cutaway = false;
  let exploded = false;
  let selected: ConductorId | null = null;
  let disposed = false;
  let fallbackActive = false;
  const delegated: BusbarViewerOptions = {
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
    delegate = createFallbackViewer(delegated);
    delegate.setFieldMode(mode);
    if (latest) delegate.update(latest);
    delegate.setSelected(selected);
    options.onError?.(reason);
  };
  try {
    delegate = createWebGLViewer(delegated, () => useFallback('context-lost'));
  } catch {
    fallbackActive = true;
    delegate = createFallbackViewer(delegated);
    options.onError?.('webgl-unavailable');
  }
  return {
    update(state) {
      latest = state;
      if (!disposed) delegate.update(state);
    },
    setFieldMode(value) {
      mode = value;
      if (!disposed) delegate.setFieldMode(value);
    },
    setCutaway(value) {
      cutaway = value;
      if (!disposed) delegate.setCutaway(cutaway);
    },
    setExploded(value) {
      exploded = value;
      if (!disposed) delegate.setExploded(exploded);
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
      if (disposed) return;
      disposed = true;
      delegate.dispose();
    },
  };
}

interface ConductorMesh {
  id: ConductorId;
  group: Group;
  mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  edges: LineSegments<BufferGeometry, LineBasicMaterial>;
  surfaces: Surface[];
  shade: Float32Array;
  temperature: Float32Array;
  current: Float32Array;
}

const NEUTRAL = [0.72, 0.47, 0.3];
const CONTEXT_COLORS: Record<string, number[]> = {
  ceramic: [0.86, 0.86, 0.84],
  'drain-island': [0.7, 0.66, 0.6],
  die: [0.23, 0.25, 0.28],
  clip: [0.62, 0.64, 0.66],
};

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function mergeSurfaces(surfaces: Surface[]) {
  const vertexCount = surfaces.reduce((sum, item) => sum + item.positions.length / 3, 0);
  const indexCount = surfaces.reduce((sum, item) => sum + item.indices.length, 0);
  const positions = new Float32Array(vertexCount * 3);
  const shade = new Float32Array(vertexCount);
  const indices = new Uint32Array(indexCount);
  let vertex = 0;
  let index = 0;
  for (const item of surfaces) {
    positions.set(item.positions, vertex * 3);
    shade.set(item.shade, vertex);
    for (let k = 0; k < item.indices.length; k += 1) indices[index + k] = item.indices[k]! + vertex;
    vertex += item.positions.length / 3;
    index += item.indices.length;
  }
  return { positions, shade, indices, vertexCount };
}

/** Box outline segments in the three.js frame. */
function boxEdges(min: number[], max: number[]): number[] {
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => [
    n & 1 ? max[0]! : min[0]!,
    n & 2 ? max[1]! : min[1]!,
    n & 4 ? max[2]! : min[2]!,
  ]);
  const pairs = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  const out: number[] = [];
  for (const [a, b] of pairs) {
    for (const c of [corners[a!]!, corners[b!]!]) out.push(c[0]!, c[2]!, -c[1]!);
  }
  return out;
}

function createWebGLViewer(options: BusbarViewerOptions, onContextLoss: () => void): BusbarViewer {
  const { container, onHover, onSelect, labels } = options;
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
  canvas.setAttribute('aria-label', labels.stage);
  canvas.dataset.busbarCanvas = 'webgl';
  container.append(canvas);
  container.dataset.busbarRenderer = 'webgl';
  container.setAttribute('role', 'group');

  const scene = new Scene();
  const root = new Group();
  scene.add(root);
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 1, 2000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 70;
  controls.maxDistance = 420;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI * 0.8;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.75;
  const activeMaterial = new MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const idleMaterial = new MeshBasicMaterial({
    color: 0x9aa0a6,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    toneMapped: false,
    side: DoubleSide,
  });
  const contextMaterial = new MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const boltMaterial = new MeshBasicMaterial({ color: 0x8e9399, toneMapped: false });
  const contextEdgeMaterial = new LineBasicMaterial({
    color: 0xa3a7ad,
    transparent: true,
    opacity: 0.5,
  });
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const conductors = new Map<ConductorId, ConductorMesh>();
  const owned: { dispose(): void }[] = [];
  let contextGroup: Group | null = null;
  let builtKey = '';
  let latest: ViewerState | null = null;
  let fieldMode: FieldMode = 'temperature';
  let selected: ConductorId | null = null;
  let hovered: ConductorId | null = null;
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
  let renderCount = 0;
  let lastUpdateMs = 0;
  let dirty = false;
  let geometryDirty = false;
  let pointerDown: { x: number; y: number; pointerId: number; moved: boolean } | null = null;
  const listenerCleanup: Array<() => void> = [];
  function listen<T extends Event>(
    target: EventTarget,
    type: string,
    listener: (event: T) => void,
  ) {
    target.addEventListener(type, listener as EventListener);
    listenerCleanup.push(() => target.removeEventListener(type, listener as EventListener));
  }
  function invalidate() {
    if (raf === 0 && !disposed && !document.hidden) raf = requestAnimationFrame(render);
  }

  function clearScene() {
    for (const item of owned.splice(0)) item.dispose();
    for (const entry of conductors.values()) root.remove(entry.group);
    conductors.clear();
    if (contextGroup) root.remove(contextGroup);
    contextGroup = null;
  }

  function buildScene(geometry: BusbarGeometry) {
    clearScene();
    const clip = isCutaway ? sectionHeight(geometry) : undefined;
    for (const id of CONDUCTOR_IDS) {
      const conductor = geometry.conductors[id];
      const offsets = latticeOffsets(conductor);
      const surfaces: Surface[] = [];
      const edgePositions: number[] = [];
      conductor.boxes.forEach((item, index) => {
        const surface = buildBoxSurface(item, offsets[index]!, clip);
        if (!surface) return;
        surfaces.push(surface);
        const top = clip === undefined ? item.max[2] : Math.min(item.max[2], clip);
        edgePositions.push(...boxEdges(item.min, [item.max[0], item.max[1], top]));
      });
      const merged = mergeSurfaces(surfaces);
      const bufferGeometry = new BufferGeometry();
      bufferGeometry.setAttribute('position', new BufferAttribute(merged.positions, 3));
      bufferGeometry.setAttribute(
        'color',
        new Float32BufferAttribute(merged.vertexCount * 3, 3).setUsage(DynamicDrawUsage),
      );
      bufferGeometry.setIndex(new BufferAttribute(merged.indices, 1));
      bufferGeometry.computeBoundingSphere();
      const mesh = new Mesh(bufferGeometry, activeMaterial);
      mesh.name = id;
      mesh.userData.conductorId = id;
      const edgeGeometry = new BufferGeometry();
      edgeGeometry.setAttribute('position', new Float32BufferAttribute(edgePositions, 3));
      const edges = new LineSegments(
        edgeGeometry,
        new LineBasicMaterial({ color: 0x7b8090, transparent: true, opacity: 0.5 }),
      );
      const group = new Group();
      group.name = `${id}-group`;
      group.add(mesh, edges);
      // Bolt and washer mark the terminal current inlet.
      const bolt = boltPlacement(conductor);
      if (bolt && (clip === undefined || bolt.top < clip)) {
        const washer = new CylinderGeometry(bolt.washerRadius, bolt.washerRadius, 0.6, 28).rotateX(
          Math.PI / 2,
        );
        const shaft = new CylinderGeometry(
          bolt.shaftRadius,
          bolt.shaftRadius,
          bolt.shaftLength,
          20,
        ).rotateX(Math.PI / 2);
        const washerMesh = new Mesh(washer, boltMaterial);
        washerMesh.position.set(bolt.x, bolt.height, bolt.washerZ);
        const shaftMesh = new Mesh(shaft, boltMaterial);
        shaftMesh.position.set(bolt.x, bolt.height, bolt.shaftZ);
        group.add(washerMesh, shaftMesh);
        owned.push(washer, shaft);
      }
      root.add(group);
      owned.push(bufferGeometry, edgeGeometry, edges.material);
      conductors.set(id, {
        id,
        group,
        mesh,
        edges,
        surfaces,
        shade: merged.shade,
        temperature: new Float32Array(merged.vertexCount),
        current: new Float32Array(merged.vertexCount),
      });
    }
    // Non-solved context: substrates, drain copper, dies and source clips.
    const contextSurfaces: Surface[] = [];
    const contextColors: number[][] = [];
    const contextEdges: number[] = [];
    for (const item of geometry.context) {
      const top = clip === undefined ? item.max[2] : Math.min(item.max[2], clip);
      if (top <= item.min[2]) continue;
      const surface = buildBoxSurface(
        { id: item.id, role: 'plate', min: item.min, max: item.max, lattice: [1, 1, 1] },
        0,
        clip,
      );
      if (!surface) continue;
      contextSurfaces.push(surface);
      contextColors.push(CONTEXT_COLORS[item.kind] ?? [0.7, 0.7, 0.7]);
      contextEdges.push(...boxEdges(item.min, [item.max[0], item.max[1], top]));
    }
    const merged = mergeSurfaces(contextSurfaces);
    const colors = new Float32Array(merged.vertexCount * 3);
    let cursor = 0;
    contextSurfaces.forEach((surface, index) => {
      const base = contextColors[index]!;
      for (let v = 0; v < surface.shade.length; v += 1) {
        for (let axis = 0; axis < 3; axis += 1)
          colors[(cursor + v) * 3 + axis] = srgbToLinear(
            base[axis]! * (0.55 + 0.45 * surface.shade[v]!),
          );
      }
      cursor += surface.shade.length;
    });
    const contextGeometry = new BufferGeometry();
    contextGeometry.setAttribute('position', new BufferAttribute(merged.positions, 3));
    contextGeometry.setAttribute('color', new BufferAttribute(colors, 3));
    contextGeometry.setIndex(new BufferAttribute(merged.indices, 1));
    const contextEdgeGeometry = new BufferGeometry();
    contextEdgeGeometry.setAttribute('position', new Float32BufferAttribute(contextEdges, 3));
    contextGroup = new Group();
    contextGroup.name = 'context';
    contextGroup.add(
      new Mesh(contextGeometry, contextMaterial),
      new LineSegments(contextEdgeGeometry, contextEdgeMaterial),
    );
    root.add(contextGroup);
    owned.push(contextGeometry, contextEdgeGeometry);
    builtKey = `${geometry.input.thicknessMm}|${geometry.input.strapWidthMm}|${isCutaway}`;
  }

  function colorize() {
    if (!latest) return;
    const range = fieldRange(latest, fieldMode);
    const lut = PALETTES[fieldMode].linear;
    for (const entry of conductors.values()) {
      const field = latest.fields?.[entry.id] ?? null;
      const active = latest.result.conductors[entry.id].active;
      entry.mesh.material = active ? activeMaterial : idleMaterial;
      entry.mesh.renderOrder = active ? 0 : 3;
      const attribute = entry.mesh.geometry.getAttribute('color') as BufferAttribute;
      const colors = attribute.array as Float32Array;
      let vertex = 0;
      for (const surface of entry.surfaces) {
        const count = surface.shade.length;
        const t = entry.temperature.subarray(vertex, vertex + count);
        const j = entry.current.subarray(vertex, vertex + count);
        if (field) {
          sampleSurface(surface, field.rise, t);
          sampleSurface(surface, field.currentDensity, j);
          for (let index = 0; index < count; index += 1) t[index] = t[index]! + latest.params.tSub;
        } else {
          t.fill(latest.params.tSub);
          j.fill(0);
        }
        vertex += count;
      }
      for (let index = 0; index < entry.shade.length; index += 1) {
        const shade = entry.shade[index]!;
        if (field) {
          const value =
            fieldMode === 'temperature' ? entry.temperature[index]! : entry.current[index]!;
          const lutIndex = paletteIndex(value, range) * 3;
          for (let axis = 0; axis < 3; axis += 1)
            colors[index * 3 + axis] = lut[lutIndex + axis]! * (0.7 + 0.3 * shade);
        } else {
          for (let axis = 0; axis < 3; axis += 1)
            colors[index * 3 + axis] = srgbToLinear(NEUTRAL[axis]! * shade);
        }
      }
      attribute.needsUpdate = true;
    }
  }

  function applyUpdate() {
    if (!latest) return;
    const start = performance.now();
    const key = `${latest.geometry.input.thicknessMm}|${latest.geometry.input.strapWidthMm}|${isCutaway}`;
    if (geometryDirty || key !== builtKey) buildScene(latest.geometry);
    geometryDirty = false;
    colorize();
    refreshOutlines();
    lastUpdateMs = performance.now() - start;
    dirty = false;
  }

  function refreshOutlines() {
    for (const entry of conductors.values()) {
      const focused = entry.id === selected || entry.id === hovered;
      entry.edges.material.color.set(focused ? 0x2997ff : 0x7b8090);
      entry.edges.material.opacity = focused ? 1 : 0.5;
      entry.edges.renderOrder = focused ? 4 : 1;
    }
  }

  function render(now: number) {
    raf = 0;
    if (disposed) return;
    if (dirty) applyUpdate();
    if (animating) {
      const t = Math.min(1, Math.max(0, (now - animationStart) / 400));
      explodeProgress = animateFrom + (animateTo - animateFrom) * t * t * (3 - 2 * t);
      if (t >= 1 || reducedMotion.matches) {
        explodeProgress = animateTo;
        animating = false;
      }
    }
    for (const entry of conductors.values())
      entry.group.position.y = EXPLODE_OFFSET_MM[entry.id] * explodeProgress;
    renderer.render(scene, camera);
    renderCount += 1;
    if (animating) invalidate();
  }

  function reset() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const distance = width / height < 0.95 ? CAMERA.portraitDistance : CAMERA.distance;
    const target = new Vector3(...CAMERA.target);
    camera.position.copy(
      new Vector3(...CAMERA.direction).normalize().multiplyScalar(distance).add(target),
    );
    controls.target.copy(target);
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

  function hitTest(event: PointerEvent) {
    if (dirty) applyUpdate();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const meshes = [...conductors.values()].map((entry) => entry.mesh);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit || !hit.face) return null;
    const entry = conductors.get(hit.object.userData.conductorId as ConductorId)!;
    const position = entry.mesh.geometry.getAttribute('position');
    const local = entry.mesh.worldToLocal(hit.point.clone());
    const [a, b, c] = [hit.face.a, hit.face.b, hit.face.c];
    const triangle = new Triangle(
      new Vector3().fromBufferAttribute(position, a),
      new Vector3().fromBufferAttribute(position, b),
      new Vector3().fromBufferAttribute(position, c),
    );
    const weights = triangle.getBarycoord(local, new Vector3()) ?? new Vector3(1, 0, 0);
    const blend = (values: Float32Array) =>
      values[a]! * weights.x + values[b]! * weights.y + values[c]! * weights.z;
    return {
      id: entry.id,
      probe: { temperature: blend(entry.temperature), currentDensity: blend(entry.current) },
    };
  }

  function setHover(
    id: ConductorId | null,
    probe: { temperature: number; currentDensity: number } | null,
  ) {
    const changed = hovered !== id;
    hovered = id;
    canvas.style.cursor = id ? 'pointer' : 'grab';
    if (changed) {
      refreshOutlines();
      invalidate();
    }
    onHover?.(id, probe);
  }

  function pointerStart(event: PointerEvent) {
    if (event.button !== 0) return;
    pointerDown = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false };
  }
  function pointerMove(event: PointerEvent) {
    if (pointerDown) {
      if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 6)
        pointerDown.moved = true;
      if (pointerDown.moved) setHover(null, null);
      return;
    }
    if (event.pointerType !== 'touch') {
      const hit = hitTest(event);
      setHover(hit?.id ?? null, hit?.probe ?? null);
    }
  }
  function pointerEnd(event: PointerEvent) {
    const start = pointerDown;
    pointerDown = null;
    if (!start || start.pointerId !== event.pointerId || start.moved) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    selected = hitTest(event)?.id ?? null;
    refreshOutlines();
    onSelect?.(selected);
    invalidate();
  }
  function pointerCancel() {
    pointerDown = null;
    setHover(null, null);
  }
  function pointerLeave() {
    if (!pointerDown) setHover(null, null);
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
    const step = Math.PI / 24;
    const spherical = new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    switch (event.key) {
      case 'ArrowLeft':
        spherical.theta += step;
        break;
      case 'ArrowRight':
        spherical.theta -= step;
        break;
      case 'ArrowUp':
        spherical.phi -= step;
        break;
      case 'ArrowDown':
        spherical.phi += step;
        break;
      case '+':
      case '=':
        spherical.radius *= 0.9;
        break;
      case '-':
      case '_':
        spherical.radius /= 0.9;
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
    update(state) {
      latest = state;
      dirty = true;
      invalidate();
    },
    setFieldMode(mode) {
      if (fieldMode === mode) return;
      fieldMode = mode;
      dirty = true;
      invalidate();
    },
    setCutaway(enabled) {
      if (isCutaway === enabled) return;
      isCutaway = enabled;
      geometryDirty = true;
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
        meshCount: conductors.size,
        vertexCount: [...conductors.values()].reduce((sum, entry) => sum + entry.shade.length, 0),
        selectedId: selected,
        hoveredId: hovered,
        cutaway: isCutaway,
        exploded: isExploded,
        fieldMode,
        lastUpdateMs,
        disposed,
        rendererInfo: {
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0,
          drawCalls: renderer.info.render.calls,
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
      clearScene();
      for (const material of [
        activeMaterial,
        idleMaterial,
        contextMaterial,
        boltMaterial,
        contextEdgeMaterial,
      ])
        material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
