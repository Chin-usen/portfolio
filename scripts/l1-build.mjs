import { createHash } from 'node:crypto';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { createModel, disposeModel } from '../model/l1-half-bridge/model.ts';
import { validateModel } from '../model/l1-half-bridge/validate.ts';
// GLTFExporter uses FileReader for its binary Blob, even when no textures exist.
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
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
export async function buildL1() {
  const model = createModel();
  const validation = validateModel(model);
  const geometryHash = createHash('sha256');
  for (const part of model.parts) {
    geometryHash.update(part.name);
    geometryHash.update(JSON.stringify(part.mesh.userData));
    geometryHash.update(JSON.stringify(part.mesh.position.toArray()));
    for (const attribute of ['position', 'normal']) {
      const array = part.mesh.geometry.getAttribute(attribute).array;
      geometryHash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
    }
    if (part.mesh.geometry.index) {
      const array = part.mesh.geometry.index.array;
      geometryHash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
    }
  }
  const raw = await new GLTFExporter().parseAsync(model.scene, {
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
  if (named.length !== model.parts.length || named.some((node) => !node.getExtras().partId))
    throw new Error('Named model nodes lost during compression');
  const manifests = model.parts.map(
    ({ mesh: _mesh, boxes: _boxes, wirePoints: _wirePoints, ...metadata }) => metadata,
  );
  const result = {
    binary,
    geometrySha256: geometryHash.digest('hex'),
    validation,
    parts: manifests,
    parameters: model.parameters,
    rawBytes: raw.byteLength,
    exportedNodeCount: named.length,
  };
  disposeModel(model);
  return result;
}
