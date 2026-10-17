import { createHash } from 'node:crypto';
import { Group } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { createPinFinAssembly, PART_IDS } from '../geometry.ts';
import { DEFAULT_PARAMS } from '../parameters.ts';

class BinaryFileReader {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      })
      .catch((error) => this.onerror?.(error));
  }
}
globalThis.FileReader = BinaryFileReader;
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});

/** Default-parameter export of the same geometry the browser rebuilds from the sliders. */
export async function buildPinFin(params = DEFAULT_PARAMS) {
  const assembly = createPinFinAssembly(params, { instanced: false, radialSegments: 20 });
  const root = new Group();
  root.name = 'pin-fin-cooler';
  root.scale.setScalar(0.001);
  root.add(assembly.group);
  root.updateMatrixWorld(true);
  try {
    const geometryHash = createHash('sha256');
    let triangles = 0;
    for (const part of assembly.parts) {
      const geometry = part.mesh.geometry;
      const positions = geometry.getAttribute('position');
      if (!positions || positions.count < 3) throw new Error(`Empty geometry ${part.id}`);
      for (const attribute of Object.values(geometry.attributes))
        if (Array.from(attribute.array).some((value) => !Number.isFinite(value)))
          throw new Error(`Nonfinite geometry ${part.id}`);
      triangles += (geometry.index?.count ?? positions.count) / 3;
      geometryHash.update(part.id);
      for (const name of ['position', 'normal']) {
        const array = geometry.getAttribute(name).array;
        geometryHash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
      }
      if (geometry.index) {
        const array = geometry.index.array;
        geometryHash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
      }
    }
    for (const id of PART_IDS)
      if (!assembly.parts.some((part) => part.id === id)) throw new Error(`Missing part ${id}`);
    const raw = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: false });
    const document = await io.readBinary(new Uint8Array(raw));
    await document.transform(
      dedup(),
      weld(),
      meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16, quantizeNormal: 10 }),
    );
    const binary = Buffer.from(await io.writeBinary(document));
    const decoded = await io.readBinary(binary);
    const named = decoded
      .getRoot()
      .listNodes()
      .filter((node) => node.getMesh());
    if (
      named.length !== PART_IDS.length ||
      named.some((node) => !PART_IDS.includes(node.getName()) || !node.getExtras().partId)
    )
      throw new Error('Pin-fin named meshes were lost during compression');
    return {
      binary,
      rawBytes: raw.byteLength,
      geometrySha256: geometryHash.digest('hex'),
      nodeCount: named.length,
      pinCount: assembly.pinCount,
      triangles,
    };
  } finally {
    assembly.dispose();
  }
}
