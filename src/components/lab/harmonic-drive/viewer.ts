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
import { createHarmonicAssembly, type HarmonicAssembly } from './geometry';
import { HARMONIC_DEFAULT_PARAMETERS, HARMONIC_PART_IDS } from './params';
import { rpmToRadiansPerSecond, type HarmonicParameters } from './math';
import { HARMONIC_TIME_FACTOR, type HarmonicStage } from './copy';

export function createHarmonicViewer(options: ViewerOptions<string>) {
  const lifetime = createViewerLifetime();
  try {
    return mountHarmonicViewer(options, lifetime);
  } catch (error) {
    try {
      lifetime.dispose();
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'Harmonic viewer initialization failed', {
        cause: cleanup,
      });
    }
    throw error;
  }
}
function mountHarmonicViewer(options: ViewerOptions<string>, lifetime: ViewerLifetime) {
  const renderer = lifetime.ownRenderer(
    new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    }),
  );
  renderer.setClearColor(0xffffff, 0);
  const canvas = renderer.domElement;
  canvas.dataset.hdWebgl = 'true';
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
  let assembly = lifetime.own(createHarmonicAssembly(HARMONIC_DEFAULT_PARAMETERS));
  scene.add(assembly.scene);
  let geometryRevision = 1;
  let parameterKey = JSON.stringify(HARMONIC_DEFAULT_PARAMETERS);
  let selected = 'flexspline';
  let stage: HarmonicStage = 'whole';
  let explode = 1;
  let rpm = 1200;
  let phase = 0;
  let playing = false;
  let disposed = false;
  let loaded = false;
  let previousTime = 0;
  let frame = 0;
  let framingDirty = true;
  let onPhase: ((angle: number) => void) | undefined;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listenerCleanup: Array<() => void> = [];
  const listen = (target: EventTarget, event: string, handler: EventListener) =>
    listenerCleanup.push(lifetime.listen(target, event, handler));
  lifetime.defer(() => {
    disposed = true;
    playing = false;
    frame = 0;
    onPhase = undefined;
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
      part.mesh.material.emissive.set(part.partId === selected ? 0x00559a : 0x000000);
      part.mesh.material.emissiveIntensity = part.partId === selected ? 0.24 : 0;
    }
  }
  function bounds() {
    const box = new Box3();
    for (const part of assembly.parts)
      if (part.mesh.visible) box.union(new Box3().setFromObject(part.mesh));
    return box;
  }
  function reset() {
    if (disposed) return;
    assembly.update(phase, { stage, explode });
    const box = bounds();
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const halfAngle = (camera.fov * Math.PI) / 360;
    const extent = Math.max(size.x / Math.max(camera.aspect, 0.1), size.y, size.z);
    const radius = Math.max(0.32, (extent / (2 * Math.tan(halfAngle))) * 1.35);
    controls.target.copy(center);
    camera.position.copy(center).add(new Vector3(0.8, 0.6, 1).normalize().multiplyScalar(radius));
    controls.minDistance = Math.max(0.12, radius * 0.35);
    controls.maxDistance = radius * 3;
    camera.lookAt(center);
    controls.update();
    framingDirty = false;
    invalidate();
  }
  function project() {
    const rect = options.container.getBoundingClientRect();
    options.onProject(
      HARMONIC_PART_IDS.map((id) => {
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
  function render(time: number) {
    frame = 0;
    if (disposed || document.hidden) return;
    if (playing && !reduced.matches) {
      if (previousTime)
        phase +=
          rpmToRadiansPerSecond(rpm) *
          Math.min((time - previousTime) / 1000, 0.05) *
          HARMONIC_TIME_FACTOR;
      previousTime = time;
    } else previousTime = 0;
    assembly.update(phase, { stage, explode });
    if (framingDirty) reset();
    renderer.render(scene, camera);
    project();
    onPhase?.(phase);
    if (!loaded) {
      loaded = true;
      options.onReady();
    }
    if (playing && rpm > 0 && !reduced.matches) invalidate();
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
    playing = false;
    options.onError();
  });
  listen(document, 'visibilitychange', () => {
    previousTime = 0;
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
      if (disposed || !HARMONIC_PART_IDS.some((part) => part === id)) return;
      selected = id;
      highlight();
      invalidate();
    },
    setMode(value: HarmonicStage) {
      if (disposed) return;
      stage = value;
      framingDirty = true;
      invalidate();
    },
    setParameters(parameters: HarmonicParameters) {
      if (disposed) return;
      const nextKey = JSON.stringify(parameters);
      if (nextKey === parameterKey) return;
      const next: HarmonicAssembly = createHarmonicAssembly(parameters);
      try {
        next.update(0, { stage, explode });
      } catch (error) {
        next.dispose();
        throw error;
      }
      lifetime.own(next);
      scene.remove(assembly.scene);
      lifetime.release(assembly);
      assembly = next;
      scene.add(assembly.scene);
      parameterKey = nextKey;
      geometryRevision++;
      phase = 0;
      playing = false;
      previousTime = 0;
      highlight();
      framingDirty = true;
      invalidate();
    },
    setRpm(value: number) {
      if (!disposed) {
        if (!Number.isFinite(value) || value < 0 || value > 1000000)
          throw new RangeError('rpm out of range');
        rpm = value;
        invalidate();
      }
    },
    setExplode(value: number) {
      if (!disposed) {
        if (!Number.isFinite(value) || value < 0 || value > 1)
          throw new RangeError('Explosion must be in [0,1]');
        explode = value;
        framingDirty = true;
        invalidate();
      }
    },
    setPhase(value: number) {
      if (!disposed) {
        if (!Number.isFinite(value)) throw new RangeError('Phase must be finite');
        phase = value;
        previousTime = 0;
        invalidate();
      }
    },
    setPhaseListener(listener: (angle: number) => void) {
      onPhase = listener;
    },
    setPlaying(value: boolean) {
      if (!disposed) {
        playing = value && !reduced.matches;
        previousTime = 0;
        invalidate();
      }
    },
    reset,
    getDiagnostics() {
      const geometries = new Set(assembly.parts.map((part) => part.mesh.geometry));
      const materials = new Set(assembly.parts.map((part) => part.mesh.material));
      const flex = assembly.parts.find((part) => part.partId === 'flexspline')!;
      const input = assembly.parts.find((part) => part.partId === 'wave-generator')!;
      const output = assembly.parts.find((part) => part.partId === 'output-flange')!;
      const vertex = new Vector3().fromBufferAttribute(
        flex.mesh.geometry.getAttribute('position'),
        Number(flex.mesh.userData.diagnosticToothTipIndex),
      );
      const toothTipWorldMm = vertex.applyMatrix4(flex.mesh.matrix).toArray();
      const box = flex.mesh.geometry.boundingBox;
      const rect = options.container.getBoundingClientRect();
      const pickTargets: { id: string; partId: string; x: number; y: number; visible: boolean }[] =
        [];
      if (!disposed)
        for (const id of HARMONIC_PART_IDS) {
          let found = false;
          for (const part of assembly.parts.filter(
            (part) => part.partId === id && part.mesh.visible,
          )) {
            const geometry = part.mesh.geometry,
              positions = geometry.getAttribute('position');
            const triangleCount = (geometry.index?.count ?? positions.count) / 3;
            for (let sample = 0; sample < 36 && !found; sample++) {
              const triangle = Math.floor(((sample + 0.5) * triangleCount) / 36);
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
        explodeProgress: explode,
        inputAngleRad: phase,
        inputRpm: rpm,
        timeFactor: HARMONIC_TIME_FACTOR,
        playing,
        ratio: assembly.model.metrics.ratio,
        parameters: { ...assembly.model.parameters },
        geometryRevision,
        flexGeometryId: disposed ? null : flex.mesh.geometry.uuid,
        actualInputRotationRad: input.mesh.rotation.z,
        actualOutputRotationRad: output.mesh.rotation.z,
        actualFlexMaterialRotationRad: flex.mesh.rotation.z,
        toothTipWorldMm,
        actualFlexBoundsMm: box ? [...box.min.toArray(), ...box.max.toArray()] : null,
        deformationMm: assembly.model.metrics.nominalDeformationMm,
        displayDeformationMm: assembly.model.metrics.displayDeformationMm,
        circularDisplayOffsetMm: assembly.model.metrics.circularDisplayOffsetMm,
        outputAngleRad: phase / assembly.model.metrics.ratio,
        // The constructor always creates exactly these two independently named zones.
        engagementAngles: [
          assembly.parts.find((part) => part.id === 'engagement-zone-1')!.mesh.rotation.z,
          assembly.parts.find((part) => part.id === 'engagement-zone-2')!.mesh.rotation.z,
        ] as [number, number],
        contactSolved: false,
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
