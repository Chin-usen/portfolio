/**
 * Original generic power-module illustration, authored for this repository.
 * Native Three.js geometry only; no product CAD, images, or texture downloads.
 * Arbitrary scene units are illustrative and do not describe an actual device.
 */
import * as THREE from 'three';

/** Small edge radii retain the reference's rectangular product silhouette. */
function softenedBox(width, height, depth, radius) {
  const geometry = new THREE.BoxGeometry(width, height, depth, 4, 4, 4);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const half = new THREE.Vector3(width / 2, height / 2, depth / 2);
  const inner = half.clone().addScalar(-radius);
  const vertex = new THREE.Vector3();
  const core = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const remap = (value, edge) => {
    const unit = value / edge;
    return Math.abs(unit) < 0.01
      ? 0
      : Math.sign(unit) * (Math.abs(unit) > 0.75 ? edge : edge - radius);
  };
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    vertex.set(remap(vertex.x, half.x), remap(vertex.y, half.y), remap(vertex.z, half.z));
    core.copy(vertex).clamp(inner.clone().negate(), inner);
    direction.subVectors(vertex, core).normalize();
    vertex.copy(core).addScaledVector(direction, radius);
    position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    normal.setXYZ(index, direction.x, direction.y, direction.z);
  }
  geometry.computeBoundingSphere();
  return geometry;
}

/** Procedural studio reflections: plain surfaces, with no third-party textures. */
function studioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#b6bbc3');
  const surfaces = [];
  const panel = (width, height, position, intensity) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setScalar(intensity),
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
    surfaces.push(mesh);
  };
  panel(10, 7, [-5, 8, 4], 4);
  panel(3, 8, [7, 3, -2], 2);
  panel(8, 5, [0, 4, -8], 1.7);
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(studio, 0.08, 0.1, 100);
  generator.dispose();
  for (const mesh of surfaces) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  return target;
}

/** Render once, then dispose all WebGL resources. No animation/runtime is shipped. */
export function renderPowerModule({ width = 900, height = 600, theme = 'light' } = {}) {
  if (!['light', 'dark'].includes(theme)) throw new Error(`Unknown theme: ${theme}`);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(2);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const environment = studioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.65;
  const camera = new THREE.OrthographicCamera(-4.8, 4.8, 3.2, -3.2, 0.1, 100);
  camera.position.set(8, 9.1, 8);
  camera.lookAt(0, 1.1, 0);
  camera.updateMatrixWorld();

  const aluminum = new THREE.MeshStandardMaterial({
    color: '#b9bdc3',
    metalness: 0.62,
    roughness: 0.4,
  });
  const housing = new THREE.MeshStandardMaterial({
    color: '#25272c',
    metalness: 0.12,
    roughness: 0.48,
  });
  const copper = new THREE.MeshStandardMaterial({
    color: '#dfa474',
    metalness: 0.5,
    roughness: 0.35,
  });
  const addBox = (name, dimensions, position, radius, material) => {
    const mesh = new THREE.Mesh(softenedBox(...dimensions, radius), material);
    mesh.name = name;
    mesh.position.set(...position);
    scene.add(mesh);
  };
  addBox('aluminum baseplate', [6, 0.28, 3.6], [0, 0.7, 0], 0.025, aluminum);
  addBox('dark rectangular housing', [5.1, 0.78, 2.85], [0, 1.23, 0], 0.027, housing);
  for (const [index, x] of [-1.65, 0, 1.65].entries()) {
    addBox(
      `copper upright terminal ${index + 1}`,
      [0.62, 0.7, 0.48],
      [x, 1.97, -0.91],
      0.012,
      copper,
    );
  }
  scene.add(new THREE.HemisphereLight('#f4f7ff', '#55565b', 0.65));
  const key = new THREE.DirectionalLight('#fff5ec', 2.4);
  key.position.set(-4, 7, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#e0e8ff', theme === 'dark' ? 0.85 : 0.5);
  rim.position.set(4, 5, -4);
  scene.add(rim);
  renderer.render(scene, camera);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = theme === 'dark' ? '#000000' : '#fbfbfd';
  context.fillRect(0, 0, width, height);
  // A broad, offset studio shadow, rather than a decorative zero-offset halo.
  const shadowPosition = new THREE.Vector3(0.85, -0.7, 0.85).project(camera);
  const shadowX = (shadowPosition.x * 0.5 + 0.5) * width;
  const shadowY = (-shadowPosition.y * 0.5 + 0.5) * height;
  context.save();
  context.translate(shadowX, shadowY);
  context.scale(width * 0.37, height * 0.09);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, 'rgba(25, 28, 34, 0.22)');
  gradient.addColorStop(0.45, 'rgba(25, 28, 34, 0.13)');
  gradient.addColorStop(1, 'rgba(25, 28, 34, 0)');
  context.fillStyle = gradient;
  context.fillRect(-1, -1, 2, 2);
  context.restore();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(renderer.domElement, 0, 0, width, height);

  scene.traverse((object) => object.geometry?.dispose());
  aluminum.dispose();
  housing.dispose();
  copper.dispose();
  environment.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return canvas;
}
