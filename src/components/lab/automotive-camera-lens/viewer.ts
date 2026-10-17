import {
  AmbientLight,
  Box3,
  DirectionalLight,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Spherical,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createViewerLifetime, type ViewerLifetime } from '../_shared/viewer-lifetime';
import type { ViewerOptions } from '../_shared/disassembly/types';
import { createAclAssembly } from './geometry';
import { ACL_LENS_IDS, ACL_PART_IDS, ACL_VIEW_DIRECTION, type AclMode } from './params';

export function createAclViewer(options: ViewerOptions<string>) {
  const lifetime = createViewerLifetime();
  try {
    return mountAclViewer(options, lifetime);
  } catch (error) {
    try {
      lifetime.dispose();
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'Camera lens viewer initialization failed', {
        cause: cleanup,
      });
    }
    throw error;
  }
}
function mountAclViewer(options: ViewerOptions<string>, lifetime: ViewerLifetime) {
  const renderer = lifetime.ownRenderer(
    new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    }),
  );
  renderer.setClearColor(0xffffff, 0);
  const canvas = renderer.domElement;
  canvas.dataset.aclWebgl = 'true';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', options.label);
  canvas.setAttribute('aria-describedby', options.keyboardDescriptionId);
  options.container.append(canvas);
  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 2.1));
  const light = new DirectionalLight(0xffffff, 3.2);
  light.position.set(-0.3, 0.6, 0.4);
  const fill = new DirectionalLight(0xdde8ff, 1.2);
  fill.position.set(0.3, 0.2, -0.3);
  scene.add(light, fill);
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
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.7;
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = Math.PI - 0.1;
  const assembly = lifetime.own(createAclAssembly());
  scene.add(assembly.scene);
  let selected = 'lens-1';
  let stage: AclMode = 'whole';
  let separation = 1;
  let disposed = false;
  let loaded = false;
  let frame = 0;
  let framingDirty = true;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const listenerCleanup: Array<() => void> = [];
  const listen = (target: EventTarget, event: string, handler: EventListener) =>
    listenerCleanup.push(lifetime.listen(target, event, handler));
  lifetime.defer(() => {
    disposed = true;
    frame = 0;
  });
  lifetime.defer(() => {
    listenerCleanup.length = 0;
    scene.clear();
  }, 'after-resources');
  function invalidate() {
    if (!disposed && !frame && !document.hidden) frame = lifetime.frame(render);
  }
  function highlight() {
    for (const part of assembly.parts) {
      // Dark mechanical finishes need a stronger emissive lift than the pale optics.
      const active = part.partId === selected;
      part.mesh.material.emissive.set(active ? 0x0a6fd6 : 0x000000);
      part.mesh.material.emissiveIntensity = active
        ? part.mesh.material.transparent
          ? 0.42
          : 0.6
        : 0;
    }
  }
  function bounds() {
    const box = new Box3();
    for (const part of assembly.parts)
      if (part.mesh.visible) box.union(new Box3().setFromObject(part.mesh));
    return box;
  }
  /** Sampled world-space vertices of each visible mesh: a much tighter hull than box
   * corners for the tilted, mostly round parts. At most 96 samples per mesh. */
  function partCorners() {
    const points: Vector3[] = [];
    for (const part of assembly.parts) {
      if (!part.mesh.visible) continue;
      const positions = part.mesh.geometry.getAttribute('position');
      const stride = Math.max(1, Math.floor(positions.count / 96));
      for (let index = 0; index < positions.count; index += stride)
        points.push(
          new Vector3().fromBufferAttribute(positions, index).applyMatrix4(part.mesh.matrixWorld),
        );
    }
    return points;
  }
  function calloutInset() {
    return window.matchMedia('(width > 1100px)').matches ? 124 + 12 : 0;
  }
  function reset() {
    if (disposed) return;
    assembly.update({ mode: stage, separation });
    const box = bounds();
    const center = box.getCenter(new Vector3());
    const direction = new Vector3(...ACL_VIEW_DIRECTION).normalize();
    const right = new Vector3().crossVectors(camera.up, direction).normalize();
    const up = new Vector3().crossVectors(direction, right);
    const width = Math.max(options.container.clientWidth, 1);
    const usableWidth = Math.max(width - calloutInset() * 2, 1);
    // Fit every world-box corner in the chosen view, including its perspective depth.
    // A 10% margin surrounds the model inside the desktop callout gutters.
    // Centre the view on the hull's extent across the screen axes, not its world box.
    const hull = partCorners();
    const across = hull.map((point) => point.clone().sub(center));
    const alongRight = across.map((offset) => offset.dot(right));
    const alongUp = across.map((offset) => offset.dot(up));
    center
      .addScaledVector(right, (Math.min(...alongRight) + Math.max(...alongRight)) / 2)
      .addScaledVector(up, (Math.min(...alongUp) + Math.max(...alongUp)) / 2);
    const tanVertical = Math.tan((camera.fov * Math.PI) / 360) / 1.1;
    const tanHorizontal = tanVertical * camera.aspect * (usableWidth / width);
    const radius = Math.max(
      ...hull.map((corner) => {
        const offset = corner.sub(center);
        return (
          offset.dot(direction) +
          Math.max(
            Math.abs(offset.dot(right)) / tanHorizontal,
            Math.abs(offset.dot(up)) / tanVertical,
            camera.near * 2,
          )
        );
      }),
    );
    controls.target.copy(center);
    camera.position.copy(center).add(direction.multiplyScalar(radius));
    controls.minDistance = Math.max(0.02, radius * 0.35);
    controls.maxDistance = radius * 3;
    camera.lookAt(center);
    controls.update();
    framingDirty = false;
    invalidate();
  }
  function project() {
    const rect = options.container.getBoundingClientRect();
    options.onProject(
      ACL_PART_IDS.map((id) => {
        const box = new Box3();
        let visible = false;
        for (const part of assembly.parts) {
          if (part.partId === id && part.mesh.visible) {
            box.union(new Box3().setFromObject(part.mesh));
            visible = true;
          }
        }
        const position = visible ? box.getCenter(new Vector3()).project(camera) : new Vector3();
        return {
          id,
          x: ((position.x + 1) * rect.width) / 2,
          y: ((1 - position.y) * rect.height) / 2,
          visible: visible && position.z >= -1 && position.z <= 1,
        };
      }),
    );
  }
  function render() {
    frame = 0;
    if (disposed || document.hidden) return;
    assembly.update({ mode: stage, separation });
    if (framingDirty) reset();
    renderer.render(scene, camera);
    project();
    if (!loaded) {
      loaded = true;
      options.onReady();
    }
  }
  function resize() {
    if (disposed) return;
    const width = options.container.clientWidth;
    const height = options.container.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    framingDirty = true;
    invalidate();
  }
  function pick(x: number, y: number) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((x - rect.left) / rect.width) * 2 - 1, (-(y - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(
      assembly.parts.filter((part) => part.mesh.visible).map((part) => part.mesh),
      false,
    );
    return hits[0]?.object.userData.partId as string | undefined;
  }
  let pointerDown: { x: number; y: number; id: number } | null = null;
  listen(canvas, 'pointerdown', (event) => {
    const p = event as PointerEvent;
    pointerDown = { x: p.clientX, y: p.clientY, id: p.pointerId };
  });
  listen(canvas, 'pointerup', (event) => {
    const p = event as PointerEvent;
    if (
      pointerDown?.id === p.pointerId &&
      Math.hypot(p.clientX - pointerDown.x, p.clientY - pointerDown.y) < 5
    ) {
      const id = pick(p.clientX, p.clientY);
      if (id) options.onSelect(id);
    }
    pointerDown = null;
  });
  listen(canvas, 'pointercancel', () => {
    pointerDown = null;
  });
  listen(canvas, 'keydown', (event) => {
    const key = event as KeyboardEvent;
    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'Home'].includes(
        key.key,
      )
    )
      return;
    key.preventDefault();
    if (key.key === 'Home') {
      reset();
      return;
    }
    const spherical = new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (key.key === 'ArrowLeft') spherical.theta -= 0.12;
    if (key.key === 'ArrowRight') spherical.theta += 0.12;
    if (key.key === 'ArrowUp') spherical.phi -= 0.1;
    if (key.key === 'ArrowDown') spherical.phi += 0.1;
    if (['+', '='].includes(key.key)) spherical.radius *= 0.9;
    if (['-', '_'].includes(key.key)) spherical.radius *= 1.1;
    spherical.radius = Math.max(
      controls.minDistance,
      Math.min(controls.maxDistance, spherical.radius),
    );
    spherical.phi = Math.max(
      controls.minPolarAngle,
      Math.min(controls.maxPolarAngle, spherical.phi),
    );
    camera.position.copy(controls.target).add(new Vector3().setFromSpherical(spherical));
    camera.lookAt(controls.target);
    controls.update();
    invalidate();
  });
  listen(canvas, 'webglcontextlost', (event) => {
    if (disposed) return;
    event.preventDefault();
    options.onError();
  });
  listen(document, 'visibilitychange', () => {
    if (document.hidden && frame) {
      lifetime.cancelFrame(frame);
      frame = 0;
    } else invalidate();
  });
  controls.addEventListener('change', invalidate);
  lifetime.defer(() => controls.removeEventListener('change', invalidate));
  lifetime.observe(new ResizeObserver(resize)).observe(options.container);
  highlight();
  resize();
  return {
    setSelected(id: string) {
      if (disposed || !ACL_PART_IDS.some((part) => part === id)) return;
      selected = id;
      highlight();
      invalidate();
    },
    setMode(value: AclMode) {
      if (disposed) return;
      stage = value;
      framingDirty = true;
      invalidate();
    },
    setSeparation(value: number) {
      if (disposed) return;
      if (!Number.isFinite(value) || value < 0 || value > 1)
        throw new RangeError('Separation must be in [0,1]');
      separation = value;
      framingDirty = true;
      invalidate();
    },
    reset,
    getDiagnostics() {
      const geometries = new Set(assembly.parts.map((part) => part.mesh.geometry));
      const materials = new Set(assembly.parts.map((part) => part.mesh.material));
      const rect = options.container.getBoundingClientRect();
      const projectedCorners = disposed ? [] : partCorners().map((point) => point.project(camera));
      const projectedX = projectedCorners.map((point) => ((point.x + 1) * rect.width) / 2);
      const projectedY = projectedCorners.map((point) => ((1 - point.y) * rect.height) / 2);
      const projectedBounds = disposed
        ? null
        : {
            left: Math.min(...projectedX),
            right: Math.max(...projectedX),
            top: Math.min(...projectedY),
            bottom: Math.max(...projectedY),
            near: Math.min(...projectedCorners.map((point) => point.z)),
            far: Math.max(...projectedCorners.map((point) => point.z)),
            viewportWidth: rect.width,
            viewportHeight: rect.height,
            calloutInset: calloutInset(),
          };
      const pickTargets: { id: string; partId: string; x: number; y: number; visible: boolean }[] =
        [];
      // Lens pick evidence only: unaccelerated raycasts are costly on software WebGL.
      if (!disposed)
        for (const id of ACL_LENS_IDS) {
          let found = false;
          for (const part of assembly.parts.filter(
            (part) => part.partId === id && part.mesh.visible,
          )) {
            const geometry = part.mesh.geometry,
              positions = geometry.getAttribute('position');
            const triangleCount = (geometry.index?.count ?? positions.count) / 3;
            for (let sample = 0; sample < 24 && !found; sample++) {
              const triangle = Math.floor(((sample + 0.5) * triangleCount) / 24);
              const center = new Vector3();
              for (let corner = 0; corner < 3; corner++) {
                const index = geometry.index
                  ? geometry.index.getX(triangle * 3 + corner)
                  : triangle * 3 + corner;
                center.add(new Vector3().fromBufferAttribute(positions, index));
              }
              center
                .multiplyScalar(1 / 3)
                .applyMatrix4(part.mesh.matrixWorld)
                .project(camera);
              if (center.z < -1 || center.z > 1) continue;
              const x = ((center.x + 1) * rect.width) / 2,
                y = ((1 - center.y) * rect.height) / 2;
              if (pick(rect.left + x, rect.top + y) === id) {
                pickTargets.push({ id, partId: id, x, y, visible: true });
                found = true;
              }
            }
            if (found) break;
          }
        }
      return {
        mode: 'webgl',
        disposed,
        loaded,
        scheduledFrame: frame !== 0,
        ownedListeners: listenerCleanup.length,
        controlsDisposed,
        geometryCount: disposed ? 0 : geometries.size,
        materialCount: disposed ? 0 : materials.size,
        meshCount: disposed ? 0 : assembly.parts.length,
        selectedId: selected,
        presentation: stage,
        separation,
        partCentersMm: Object.fromEntries(
          ACL_PART_IDS.map((id) => {
            const box = new Box3();
            for (const part of assembly.parts.filter((p) => p.partId === id)) {
              const local = part.mesh.geometry.boundingBox!.clone().translate(part.mesh.position);
              box.union(local);
            }
            return [id, box.getCenter(new Vector3()).toArray()];
          }),
        ),
        pickTargets,
        visiblePartIds: disposed
          ? []
          : [
              ...new Set(
                assembly.parts.filter((part) => part.mesh.visible).map((part) => part.partId),
              ),
            ],
        cameraPosition: camera.position.toArray(),
        cameraTarget: controls.target.toArray(),
        cameraRadius: camera.position.distanceTo(controls.target),
        projectedBounds,
        rendererInfo: {
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0,
          contextLost: renderer.getContext().isContextLost(),
        },
      };
    },
    dispose() {
      if (!disposed) lifetime.dispose();
    },
  };
}
