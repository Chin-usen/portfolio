import {
  AmbientLight,
  ArrowHelper,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  Line,
  LineBasicMaterial,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Spherical,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createViewerLifetime, type ViewerLifetime } from '../_shared/viewer-lifetime';
import {
  PART_IDS,
  type PartId,
  type BridgeMode,
  type BridgeViewerDiagnostics,
  type ModelManifest,
  type ProjectedAnchor,
} from './types';

const partIds = new Set<string>(PART_IDS);
const GAP_DISPLAY_SCALE = 4;
const TRANSITION_MS = 480;
type OwnedMesh = {
  mesh: Mesh;
  partId: PartId;
  explode: number;
  gapMotion: number;
  gapScale: boolean;
  geometryCenterY: number;
  geometryMinY: number;
  geometryHeight: number;
  base: Vector3;
  colors: Color[];
  opacity: number[];
  transparent: boolean[];
  depthWrite: boolean[];
};
type Options = {
  container: HTMLElement;
  onSelect: (id: PartId) => void;
  onProject: (anchors: ProjectedAnchor[]) => void;
  onReady: () => void;
  onError: () => void;
  label: string;
};
export function createHalfBridgeViewer(options: Options) {
  const lifetime = createViewerLifetime();
  try {
    return mountHalfBridgeViewer(options, lifetime);
  } catch (error) {
    try {
      lifetime.dispose();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Viewer initialization failed', {
        cause: cleanupError,
      });
    }
    throw error;
  }
}

function mountHalfBridgeViewer(options: Options, lifetime: ViewerLifetime) {
  const { container, onSelect, onProject, onReady, onError } = options;
  const renderer = lifetime.ownRenderer(
    new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    }),
  );
  renderer.setClearColor(0xffffff, 0);
  const canvas = renderer.domElement;
  canvas.dataset.l1Webgl = 'true';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', options.label);
  canvas.setAttribute('aria-describedby', 'l1-keyboard');
  container.append(canvas);
  const scene = new Scene();
  const modelRoot = new Group();
  const annotations = new Group();
  scene.add(modelRoot, annotations);
  scene.add(new AmbientLight(0xffffff, 2.15));
  const light = new DirectionalLight(0xffffff, 3.3);
  light.position.set(-0.2, 0.4, 0.3);
  scene.add(light);
  const fill = new DirectionalLight(0xdde8ff, 1.15);
  fill.position.set(0.3, 0.2, -0.3);
  scene.add(fill);
  const camera = new PerspectiveCamera(32, 1, 0.001, 10);
  let controlsDisposed = false;
  const controls = new OrbitControls(camera);
  lifetime.defer(() => {
    try {
      controls.dispose();
    } finally {
      controlsDisposed = true;
    }
  });
  controls.connect(canvas);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 0.14;
  controls.maxDistance = 0.75;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI * 0.83;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.7;
  const listenerCleanup: Array<() => void> = [];
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const meshes: OwnedMesh[] = [];
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let manifest: ModelManifest | null = null;
  let selected: PartId = 'busbar';
  let mode: BridgeMode = 'exploded';
  let playing = false;
  let gap = 0.5;
  let progress = 1;
  let animateFrom = 1;
  let animateTo = 1;
  let animationStart = 0;
  let animating = false;
  let frame = 0;
  let disposed = false;
  let loaded = false;
  let animationClock = 0;
  let previousTime = 0;
  let framingDirty = true;
  const arrowEntries: { arrow: ArrowHelper; rail: 'p' | 'n'; index: number }[] = [];
  const fieldEntries: { line: Line; arrow: ArrowHelper; rail: 'p' | 'n' }[] = [];
  const flowSegments: { arrow: ArrowHelper; line: Line; index: number }[] = [];
  let pointerDown: { x: number; y: number; id: number } | null = null;

  lifetime.defer(() => {
    disposed = true;
    frame = 0;
  });
  lifetime.defer(() => {
    listenerCleanup.length = 0;
    geometries.clear();
    materials.clear();
    meshes.length = 0;
    arrowEntries.length = 0;
    fieldEntries.length = 0;
    flowSegments.length = 0;
    modelRoot.clear();
    annotations.clear();
    scene.clear();
  }, 'after-resources');

  function listen(target: EventTarget, type: string, callback: EventListener) {
    listenerCleanup.push(lifetime.listen(target, type, callback));
  }
  function invalidate() {
    if (!disposed && !frame && !document.hidden) frame = lifetime.frame(render);
  }
  function collectResources(object: Object3D) {
    object.traverse((item) => {
      if (item instanceof Mesh || item instanceof Line) {
        geometries.add(lifetime.own(item.geometry));
        const list = Array.isArray(item.material) ? item.material : [item.material];
        for (const material of list) materials.add(lifetime.ownMaterial(material));
      }
    });
  }
  function ownDecodedResources(objects: Object3D[]) {
    // Register every decoded scene, even unused scenes and late parse results.
    // Late registration releases immediately, so drain failures independently.
    const resources: Array<() => void> = [];
    for (const object of new Set(objects)) {
      object.traverse((item) => {
        if (!(item instanceof Mesh || item instanceof Line)) return;
        resources.push(() => {
          lifetime.own(item.geometry);
        });
        for (const material of Array.isArray(item.material) ? item.material : [item.material])
          resources.push(() => {
            lifetime.ownMaterial(material);
          });
      });
    }
    const errors: unknown[] = [];
    for (const own of resources) {
      try {
        own();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Decoded model cleanup failed');
  }
  function disposeObject(object: Object3D) {
    object.traverse((item) => {
      if (item instanceof Mesh || item instanceof Line) {
        lifetime.own(item.geometry);
        lifetime.release(item.geometry);
        for (const material of Array.isArray(item.material) ? item.material : [item.material]) {
          // Cloned materials may share textures: keep those owned until viewer disposal.
          lifetime.ownMaterial(material);
          lifetime.release(material);
        }
      }
    });
  }
  function metadata(object: Object3D): {
    partId: PartId;
    name: string;
    circuitNode: string | undefined;
    explode: number;
    gapMotion: number;
    gapScale: boolean;
  } | null {
    let current: Object3D | null = object;
    while (current) {
      const part = manifest?.parts.find((entry) => entry.name === current?.name);
      const id = current.userData.partId ?? part?.partId;
      if (typeof id === 'string' && partIds.has(id))
        return {
          partId: id as PartId,
          name: current.name,
          circuitNode: current.userData.circuitNode ?? part?.circuitNode,
          explode: Number(current.userData.explodeZmm ?? part?.explodeZmm ?? 0) / 1000,
          gapMotion: Number(current.userData.gapMotion ?? part?.gapMotion ?? 0),
          gapScale: Boolean(current.userData.gapScale ?? part?.gapScale ?? false),
        };
      current = current.parent;
    }
    return null;
  }
  function refreshHighlight() {
    for (const entry of meshes) {
      const list = Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material];
      list.forEach((material, index) => {
        if (material instanceof MeshStandardMaterial) {
          material.color.copy(entry.colors[index] ?? new Color(0xffffff));
          material.emissive.set(entry.partId === selected ? 0x00559a : 0x000000);
          material.emissiveIntensity = entry.partId === selected ? 0.28 : 0;
          const faded =
            mode === 'commutation' &&
            !['busbar', 'mosfet', 'dc-terminal', 'ac-terminal'].includes(entry.partId);
          // The overlapping power plates and film become an x-ray shell in this
          // teaching view, exposing the die/strap path beneath the real surfaces.
          const xray =
            mode === 'commutation' &&
            ['busbar-p', 'busbar-n', 'busbar-insulation'].includes(entry.mesh.name);
          const opacity = xray ? 0.12 : faded ? 0.15 : 1;
          material.opacity = Math.min(opacity, entry.opacity[index] ?? 1);
          const transparent = faded || xray || (entry.transparent[index] ?? false);
          if (material.transparent !== transparent) {
            material.transparent = transparent;
            material.needsUpdate = true;
          }
          material.depthWrite = faded || xray ? false : (entry.depthWrite[index] ?? true);
        }
      });
    }
  }
  function applyPositions() {
    const defaultGap = manifest?.parameters.busbarGapMm ?? 0.5;
    const gapOffset = (gap * GAP_DISPLAY_SCALE - defaultGap) / 1000;
    for (const entry of meshes) {
      // The joined collector bridges stationary SL clips and the moving N plate.
      // Stretch about its bottom contact plane; translating it would open all
      // four source contacts, including at the default 4x display exaggeration.
      const stretchCollector = entry.mesh.name === 'n-source-collector' && entry.geometryHeight > 0;
      const scale = stretchCollector
        ? 1 + (entry.gapMotion * gapOffset) / entry.geometryHeight
        : entry.gapScale
          ? (gap * GAP_DISPLAY_SCALE) / defaultGap
          : 1;
      entry.mesh.scale.y = scale;
      entry.mesh.position.copy(entry.base);
      entry.mesh.position.y +=
        (stretchCollector ? entry.geometryMinY : entry.geometryCenterY) * (1 - scale);
      entry.mesh.position.y +=
        entry.explode * progress + (stretchCollector ? 0 : entry.gapMotion * gapOffset);
    }
    modelRoot.updateMatrixWorld(true);
  }
  function boundsFor(id: PartId, name?: string): Box3 | null {
    const box = new Box3();
    let found = false;
    for (const entry of meshes) {
      if (
        entry.partId === id &&
        (!name || entry.mesh.name === name || entry.mesh.userData.circuitNode === name)
      ) {
        box.union(new Box3().setFromObject(entry.mesh));
        found = true;
      }
    }
    return found ? box : null;
  }
  function sourceCollectorContacts(): BridgeViewerDiagnostics['sourceCollectorContacts'] {
    const collector = meshes.find((entry) => entry.mesh.name === 'n-source-collector')?.mesh;
    if (!collector) return [];
    const collectorBox = new Box3().setFromObject(collector);
    const contactRay = new Raycaster();
    return meshes
      .filter((entry) => entry.mesh.name.startsWith('source-clip-sl-'))
      .map(({ mesh }) => {
        const clipBox = new Box3().setFromObject(mesh);
        const center = clipBox.getCenter(new Vector3());
        const origin = new Vector3(
          center.x,
          Math.min(clipBox.min.y, collectorBox.min.y) - 0.001,
          center.z,
        );
        // Sample the real transformed surfaces at the clip centre. A missing
        // collector surface is null, not a misleading zero from a broad AABB.
        contactRay.set(origin, new Vector3(0, 1, 0));
        const collectorHit = contactRay.intersectObject(collector, false)[0];
        contactRay.set(
          new Vector3(center.x, clipBox.max.y + 0.001, center.z),
          new Vector3(0, -1, 0),
        );
        const clipHit = contactRay.intersectObject(mesh, false)[0];
        return {
          clipName: mesh.name,
          gapMm: collectorHit && clipHit ? (collectorHit.point.y - clipHit.point.y) * 1000 : null,
        };
      });
  }
  function railBounds(rail: 'p' | 'n'): Box3 | null {
    const plates = meshes.filter(
      (entry) => entry.partId === 'busbar' && entry.mesh.name === `busbar-${rail}`,
    );
    const matches = plates.length
      ? plates
      : meshes.filter(
          (entry) => entry.partId === 'busbar' && entry.mesh.userData.circuitNode === rail,
        );
    if (!matches.length) return null;
    const box = new Box3();
    for (const entry of matches) box.union(new Box3().setFromObject(entry.mesh));
    return box;
  }
  function circuitCenter(node: string, partId?: PartId): Vector3 | null {
    const entries = meshes.filter(
      (entry) => entry.mesh.userData.circuitNode === node && (!partId || entry.partId === partId),
    );
    if (!entries.length) return null;
    const box = new Box3();
    for (const entry of entries) box.union(new Box3().setFromObject(entry.mesh));
    return box.getCenter(new Vector3()).setY(box.max.y + 0.006);
  }
  function currentPath(): Vector3[] | null {
    // These guides use actual model node bounds; they are current-direction annotations,
    // not additional conductors or invented replacement geometry.
    const acStrap = boundsFor('ac-terminal', 'ac-source-drain-strap');
    const points = [
      circuitCenter('p', 'dc-terminal'),
      circuitCenter('p', 'busbar'),
      circuitCenter('sh', 'mosfet'),
      acStrap
        ? acStrap.getCenter(new Vector3()).setY(acStrap.max.y + 0.006)
        : circuitCenter('ac', 'busbar'),
      circuitCenter('sl', 'mosfet'),
      circuitCenter('n', 'busbar'),
      circuitCenter('n', 'dc-terminal'),
    ];
    return points.every((point): point is Vector3 => point !== null) ? points : null;
  }
  function createAnnotations() {
    for (let index = 0; index < 6; index += 1) {
      const arrow = new ArrowHelper(
        new Vector3(1, 0, 0),
        new Vector3(),
        0.008,
        0xb24912,
        0.003,
        0.0015,
      );
      collectResources(arrow);
      const line = new Line(
        lifetime.own(new BufferGeometry()).setFromPoints([new Vector3(), new Vector3()]),
        lifetime.ownMaterial(
          new LineBasicMaterial({ color: 0xb24912, transparent: true, opacity: 0.85 }),
        ),
      );
      line.frustumCulled = false;
      annotations.add(arrow, line);
      flowSegments.push({ arrow, line, index });
    }
    for (const rail of ['p', 'n'] as const) {
      const color = rail === 'p' ? 0x0066cc : 0xb24912;
      for (let index = 0; index < 3; index++) {
        const arrow = new ArrowHelper(
          new Vector3(rail === 'p' ? 1 : -1, 0, 0),
          new Vector3(),
          0.012,
          color,
          0.003,
          0.002,
        );
        collectResources(arrow);
        annotations.add(arrow);
        arrowEntries.push({ arrow, rail, index });
      }
      const points = Array.from({ length: 65 }, (_, index) => {
        const angle = (index / 64) * Math.PI * 2;
        return new Vector3(0, Math.cos(angle) * 0.011, Math.sin(angle) * 0.011);
      });
      const line = new Line(
        lifetime.own(new BufferGeometry()).setFromPoints(points),
        lifetime.ownMaterial(new LineBasicMaterial({ color, transparent: true, opacity: 0.62 })),
      );
      const arrow = new ArrowHelper(
        new Vector3(0, 1, 0),
        new Vector3(),
        0.003,
        color,
        0.002,
        0.0015,
      );
      collectResources(arrow);
      annotations.add(line, arrow);
      fieldEntries.push({ line, arrow, rail });
    }
    // Current/field annotations are diagram overlays, not solid conductors.
    // Draw every arrow component after transparent model surfaces so neither
    // broad plates nor the housing can hide a segment of the transient path.
    annotations.traverse((item) => {
      if (!(item instanceof Mesh || item instanceof Line)) return;
      item.renderOrder = item instanceof Mesh ? 31 : 30;
      const list = Array.isArray(item.material) ? item.material : [item.material];
      for (const material of list) {
        material.depthTest = false;
        material.depthWrite = false;
        material.transparent = true;
        material.toneMapped = false;
      }
    });
    collectResources(annotations);
  }
  function updateAnnotations() {
    annotations.visible = mode === 'commutation';
    if (!annotations.visible) return;
    const path = currentPath();
    for (const { arrow, line, index } of flowSegments) {
      const start = path?.[index];
      const end = path?.[index + 1];
      if (!start || !end || start.distanceToSquared(end) < 1e-9) {
        arrow.visible = line.visible = false;
        continue;
      }
      arrow.visible = line.visible = true;
      const direction = end.clone().sub(start);
      const length = direction.length();
      direction.normalize();
      const arrowLength = Math.min(0.009, length * 0.45);
      const phase = (animationClock / 1800) % 1;
      arrow.position.copy(start).addScaledVector(direction, phase * (length - arrowLength));
      arrow.setDirection(direction);
      arrow.setLength(arrowLength, arrowLength * 0.35, arrowLength * 0.22);
      const positions = line.geometry.getAttribute('position');
      positions.setXYZ(0, start.x, start.y, start.z);
      positions.setXYZ(1, end.x, end.y, end.z);
      positions.needsUpdate = true;
    }
    for (const { arrow, rail, index } of arrowEntries) {
      const box = railBounds(rail);
      if (!box) {
        arrow.visible = false;
        continue;
      }
      arrow.visible = true;
      const center = box.getCenter(new Vector3());
      const phase = (animationClock / 2600 + index / 3) % 1;
      const t = rail === 'p' ? phase : 1 - phase;
      const margin = 0.008;
      arrow.position.set(
        box.min.x + margin + (box.max.x - box.min.x - margin * 2) * t,
        box.max.y + 0.002,
        center.z + (rail === 'p' ? -1 : 1) * (box.max.z - box.min.z) * 0.22,
      );
    }
    for (const { line, arrow, rail } of fieldEntries) {
      const box = railBounds(rail);
      if (!box) {
        line.visible = arrow.visible = false;
        continue;
      }
      line.visible = arrow.visible = true;
      const center = box.getCenter(new Vector3());
      line.position.copy(center);
      const direction = rail === 'p' ? 1 : -1;
      const angle = direction * ((animationClock / 1800) * Math.PI * 2);
      arrow.position
        .copy(center)
        .add(new Vector3(0, Math.cos(angle) * 0.011, Math.sin(angle) * 0.011));
      arrow.setDirection(
        new Vector3(0, -Math.sin(angle) * direction, Math.cos(angle) * direction).normalize(),
      );
    }
  }
  function projectAnchors(): ProjectedAnchor[] {
    return PART_IDS.flatMap((id) => {
      const box = boundsFor(id);
      if (!box) return [];
      const center = box.getCenter(new Vector3()).project(camera);
      return [
        {
          id,
          x: ((center.x + 1) * container.clientWidth) / 2,
          y: ((1 - center.y) * container.clientHeight) / 2,
          visible: center.z > -1 && center.z < 1,
        },
      ];
    });
  }
  function render(now: number) {
    frame = 0;
    if (disposed) return;
    if (animating) {
      const elapsed = Math.min(1, (now - animationStart) / TRANSITION_MS);
      progress = animateFrom + (animateTo - animateFrom) * (1 - Math.pow(1 - elapsed, 3));
      if (elapsed === 1 || reduced.matches) {
        progress = animateTo;
        animating = false;
      }
    }
    if (playing && mode === 'commutation')
      animationClock += previousTime ? Math.min(now - previousTime, 100) : 0;
    previousTime = now;
    applyPositions();
    if (loaded && (framingDirty || animating)) centerModel();
    framingDirty = animating;
    updateAnnotations();
    renderer.render(scene, camera);
    if (loaded) onProject(projectAnchors());
    if (animating || (playing && mode === 'commutation' && !reduced.matches)) invalidate();
  }
  function modelCenter() {
    return loaded
      ? new Box3().setFromObject(modelRoot).getCenter(new Vector3())
      : new Vector3(0, 0.032, 0);
  }
  function centerModel() {
    // Translate both together: changing the layer height must not reset a
    // visitor's orbit direction or zoom, including during the 480 ms transition.
    const center = modelCenter();
    const offset = center.clone().sub(controls.target);
    if (offset.lengthSq() < 1e-12) return;
    camera.position.add(offset);
    controls.target.copy(center);
    controls.update();
  }
  function reset() {
    const portrait = container.clientWidth / Math.max(1, container.clientHeight) < 1;
    const distance = portrait ? 0.37 : 0.32;
    const target = modelCenter();
    camera.position
      .copy(target)
      .add(new Vector3(0.9, 0.74, 1.25).normalize().multiplyScalar(distance));
    controls.target.copy(target);
    controls.update();
    invalidate();
  }
  function resize() {
    if (disposed) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }
  function pick(clientX: number, clientY: number): PartId | null {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((clientY - rect.top) / rect.height) * 2,
    );
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster
      .intersectObjects(
        meshes.map((entry) => entry.mesh),
        false,
      )
      .find((hit) => {
        const entry = meshes.find((item) => item.mesh === hit.object);
        return (
          entry &&
          !(
            mode === 'commutation' &&
            ['housing', 'baseplate', 'amb', 'solder'].includes(entry.partId)
          )
        );
      });
    return hit ? (meshes.find((entry) => entry.mesh === hit.object)?.partId ?? null) : null;
  }
  function keyboard(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Home') {
      event.preventDefault();
      reset();
      return;
    }
    const spherical = new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    switch (event.key) {
      case 'ArrowLeft':
        spherical.theta += Math.PI / 24;
        break;
      case 'ArrowRight':
        spherical.theta -= Math.PI / 24;
        break;
      case 'ArrowUp':
        spherical.phi -= Math.PI / 24;
        break;
      case 'ArrowDown':
        spherical.phi += Math.PI / 24;
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
  listen(canvas, 'pointerdown', ((event: PointerEvent) => {
    if (event.button === 0)
      pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }) as EventListener);
  listen(canvas, 'pointerup', ((event: PointerEvent) => {
    const start = pointerDown;
    pointerDown = null;
    if (
      !start ||
      start.id !== event.pointerId ||
      Math.hypot(start.x - event.clientX, start.y - event.clientY) > 5
    )
      return;
    const id = pick(event.clientX, event.clientY);
    if (id) onSelect(id);
  }) as EventListener);
  listen(canvas, 'pointercancel', () => {
    pointerDown = null;
  });
  listen(canvas, 'dblclick', reset);
  listen(canvas, 'keydown', keyboard as EventListener);
  listen(canvas, 'webglcontextlost', (event) => {
    event.preventDefault();
    if (!disposed)
      queueMicrotask(() => {
        if (!disposed) onError();
      });
  });
  listen(document, 'visibilitychange', () => {
    previousTime = 0;
    if (document.hidden && frame) {
      lifetime.cancelFrame(frame);
      frame = 0;
    } else invalidate();
  });
  controls.addEventListener('change', invalidate);
  listenerCleanup.push(lifetime.defer(() => controls.removeEventListener('change', invalidate)));
  const resizeObserver = lifetime.observe(new ResizeObserver(resize));
  resizeObserver.observe(container);
  resize();
  reset();

  async function load() {
    try {
      const [modelResponse, manifestResponse] = await Promise.all([
        fetch('/models/l1/half-bridge.glb', { signal: lifetime.signal }),
        fetch('/models/l1/model-manifest.json', { signal: lifetime.signal }),
      ]);
      if (disposed) return;
      if (!modelResponse.ok || !manifestResponse.ok) throw new Error('model assets unavailable');
      const [buffer, data] = await Promise.all([
        modelResponse.arrayBuffer(),
        manifestResponse.json(),
      ]);
      if (disposed) return;
      manifest = data as ModelManifest;
      if (manifest.units !== 'm' || manifest.upAxis !== 'Y')
        throw new Error('Unsupported model coordinate system');
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.parseAsync(buffer, '/models/l1/');
      ownDecodedResources([gltf.scene, ...gltf.scenes]);
      if (disposed) return;
      gltf.scene.updateMatrixWorld(true);
      const extracted: Mesh[] = [];
      gltf.scene.traverse((object) => {
        if (object instanceof Mesh) extracted.push(object);
      });
      for (const object of extracted) {
        const data = metadata(object);
        if (!data) continue;
        // Bake the model node transform into geometry before adopting a flat scene.
        const world = object.matrixWorld.clone();
        const geometry = lifetime.own(object.geometry.clone());
        geometry.applyMatrix4(world);
        geometry.computeBoundingBox();
        const list = Array.isArray(object.material) ? object.material : [object.material];
        const cloned = list.map((material) => lifetime.ownMaterial(material.clone()));
        const mesh = new Mesh(geometry, Array.isArray(object.material) ? cloned : cloned[0]);
        mesh.name = data.name || object.name;
        mesh.userData = { ...object.userData, partId: data.partId, circuitNode: data.circuitNode };
        modelRoot.add(mesh);
        const colors = cloned.map((material) =>
          material instanceof MeshStandardMaterial ? material.color.clone() : new Color(0xffffff),
        );
        meshes.push({
          mesh,
          partId: data.partId,
          explode: data.explode,
          gapMotion: data.gapMotion,
          gapScale: data.gapScale,
          geometryCenterY: geometry.boundingBox?.getCenter(new Vector3()).y ?? 0,
          geometryMinY: geometry.boundingBox?.min.y ?? 0,
          geometryHeight: geometry.boundingBox?.getSize(new Vector3()).y ?? 0,
          base: mesh.position.clone(),
          colors,
          opacity: cloned.map((material) => material.opacity),
          transparent: cloned.map((material) => material.transparent),
          depthWrite: cloned.map((material) => material.depthWrite),
        });
      }
      disposeObject(gltf.scene);
      if (!meshes.length) throw new Error('Empty model');
      collectResources(modelRoot);
      createAnnotations();
      loaded = true;
      applyPositions();
      centerModel();
      refreshHighlight();
      onReady();
      invalidate();
    } catch {
      if (!disposed && !lifetime.signal.aborted) {
        try {
          lifetime.dispose();
        } catch {
          // All release phases ran; the page's fallback still needs notification.
        }
        onError();
      }
    }
  }
  void load();

  function visiblePickTargets() {
    if (!loaded || disposed) return [];
    scene.updateMatrixWorld(true);
    const rect = canvas.getBoundingClientRect();
    // Ray-tested samples, rather than geometric centres that may be occluded.
    const targets: { partId: PartId; x: number; y: number }[] = [];
    const seen = new Set<PartId>();
    for (const entry of meshes) {
      if (seen.has(entry.partId)) continue;
      const box = new Box3().setFromObject(entry.mesh);
      const center = box.getCenter(new Vector3());
      const samples = [
        center,
        ...[0.25, 0.75].flatMap((tx) =>
          [0.25, 0.75].map(
            (tz) =>
              new Vector3(
                box.min.x + (box.max.x - box.min.x) * tx,
                box.max.y,
                box.min.z + (box.max.z - box.min.z) * tz,
              ),
          ),
        ),
      ];
      for (const sample of samples) {
        sample.project(camera);
        const x = ((sample.x + 1) * rect.width) / 2;
        const y = ((1 - sample.y) * rect.height) / 2;
        if (
          x > 0 &&
          x < rect.width &&
          y > 0 &&
          y < rect.height &&
          document.elementFromPoint(rect.left + x, rect.top + y) === canvas &&
          pick(rect.left + x, rect.top + y) === entry.partId
        ) {
          targets.push({ partId: entry.partId, x, y });
          seen.add(entry.partId);
          break;
        }
      }
    }
    return targets;
  }

  return {
    setSelected(id: PartId) {
      selected = id;
      refreshHighlight();
      invalidate();
    },
    setMode(next: BridgeMode) {
      mode = next;
      framingDirty = true;
      animateFrom = progress;
      animateTo = next === 'exploded' ? 1 : 0;
      animationStart = performance.now();
      animating = !reduced.matches && Math.abs(animateFrom - animateTo) > 0.001;
      if (!animating) progress = animateTo;
      refreshHighlight();
      invalidate();
    },
    setGap(value: number) {
      gap = value;
      framingDirty = true;
      invalidate();
    },
    setPlaying(value: boolean) {
      playing = value && !reduced.matches;
      previousTime = 0;
      invalidate();
    },
    reset,
    getDiagnostics(): BridgeViewerDiagnostics & {
      pickTargets: { partId: PartId; x: number; y: number }[];
      busbarPositions: { pY: number | null; nY: number | null };
      cameraPosition: number[];
      cameraTarget: number[];
      cameraRadius: number;
      currentPathAnchors: number[][];
    } {
      const p = railBounds('p');
      const n = railBounds('n');
      const collector = boundsFor('busbar', 'n-source-collector');
      return {
        mode: 'webgl',
        disposed,
        loaded,
        scheduledFrame: frame !== 0,
        ownedListeners: listenerCleanup.length,
        controlsDisposed,
        geometryCount: geometries.size,
        meshCount: meshes.length,
        selectedId: selected,
        presentation: mode,
        explodeProgress: progress,
        gapMm: gap,
        gapDisplayScale: GAP_DISPLAY_SCALE,
        sourceCollectorContacts: sourceCollectorContacts(),
        sourceCollectorBounds: collector
          ? {
              bottomYmm: collector.min.y * 1000,
              topYmm: collector.max.y * 1000,
              nPlateTopYmm: n ? n.max.y * 1000 : null,
            }
          : null,
        rendererInfo: {
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0,
          contextLost: renderer.getContext().isContextLost(),
        },
        pickTargets: visiblePickTargets(),
        cameraPosition: camera.position.toArray(),
        cameraTarget: controls.target.toArray(),
        cameraRadius: camera.position.distanceTo(controls.target),
        currentPathAnchors: currentPath()?.map((point) => point.toArray()) ?? [],
        busbarPositions: {
          pY: p ? p.getCenter(new Vector3()).y : null,
          nY: n ? n.getCenter(new Vector3()).y : null,
        },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.dispose();
    },
  };
}
