import { createHash } from 'node:crypto';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { createAclAssembly } from '../geometry.ts';
import { ACL_PART_IDS } from '../params.ts';

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
/** Build the named, compressed GLB from the same generator the runtime viewer uses. */
export async function buildAutomotiveCameraLens() {
  const assembly = createAclAssembly();
  try {
    const geometryHash = createHash('sha256');
    const ids = new Set();
    let triangles = 0;
    for (const part of assembly.parts) {
      if (ids.has(part.id)) throw new Error(`Duplicate camera lens component ${part.id}`);
      ids.add(part.id);
      const geometry = part.mesh.geometry;
      const positions = geometry.getAttribute('position');
      if (!positions || positions.count < 3) throw new Error(`Empty geometry ${part.id}`);
      for (const attribute of Object.values(geometry.attributes)) {
        if (Array.from(attribute.array).some((value) => !Number.isFinite(value)))
          throw new Error(`Nonfinite geometry ${part.id}`);
      }
      triangles += (geometry.index?.count ?? positions.count) / 3;
      geometryHash.update(part.mesh.name);
      geometryHash.update(JSON.stringify(part.mesh.userData));
      geometryHash.update(JSON.stringify(part.mesh.matrixWorld.toArray()));
      for (const attribute of ['position', 'normal']) {
        const array = geometry.getAttribute(attribute).array;
        geometryHash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
      }
    }
    for (const id of ACL_PART_IDS)
      if (!assembly.parts.some((part) => part.partId === id))
        throw new Error(`Missing part group ${id}`);
    const raw = await new GLTFExporter().parseAsync(assembly.scene, {
      binary: true,
      onlyVisible: false,
    });
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
      named.length !== assembly.parts.length ||
      named.some((node) => !ids.has(node.getName()) || !node.getExtras().partId)
    )
      throw new Error('Camera lens named meshes were lost during compression');
    return {
      binary,
      rawBytes: raw.byteLength,
      geometrySha256: geometryHash.digest('hex'),
      nodeCount: named.length,
      triangles,
      optics: {
        prescription: assembly.optics.prescription,
        metrics: assembly.optics.metrics,
        stopZmm: assembly.optics.stopZ,
        stopRadiusMm: assembly.optics.stopRadius,
        elements: assembly.optics.elements,
      },
      dims: assembly.layout.dims,
      parts: assembly.parts.map(({ mesh, id, partId, group }) => ({
        id,
        partId,
        group,
        ...mesh.userData,
      })),
    };
  } finally {
    assembly.dispose();
  }
}
