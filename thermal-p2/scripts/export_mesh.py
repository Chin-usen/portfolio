"""Export the actual L3 quarter-domain topology and default physical coordinates."""
from pathlib import Path
import json
import sys
import hashlib
import numpy as np
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from solver.fem import StackMesh, LEVELS, DEFAULTS, LAYER_IDS, physical_arrays, WIDTHS_MM

mesh = StackMesh(LEVELS[2])
node_keys = np.empty((mesh.n_nodes, 3), dtype=np.int32)
for key, index in mesh.node_map.items():
    node_keys[index] = key
z_layer = np.minimum(np.searchsorted(mesh.z_offsets, node_keys[:, 2], side='right') - 1, 6)
z_eta = (node_keys[:, 2] - mesh.z_offsets[z_layer]) / np.asarray(mesh.level.z_counts)[z_layer]
thickness, conductivities = physical_arrays(DEFAULTS)
z_base = np.r_[0., np.cumsum(thickness)]
xyz = np.column_stack((mesh.x_mm[node_keys[:, 0]], mesh.x_mm[node_keys[:, 1]], z_base[z_layer] + z_eta * thickness[z_layer]))
cells, layers = [], []
for layer, (limit, nz) in enumerate(zip(mesh.xy_limits, mesh.level.z_counts)):
    offset = int(mesh.z_offsets[layer])
    for iz in range(nz):
        for iy in range(limit):
            for ix in range(limit):
                cells.append([mesh.node_map[(ix + dx, iy + dy, offset + iz + dz)] for dz in (0, 1) for dy in (0, 1) for dx in (0, 1)])
                layers.append(layer)
cells = np.asarray(cells, dtype=np.int32)
layers = np.asarray(layers, dtype=np.uint8)
assert cells.shape == (mesh.n_elements, 8)
assert np.array_equal(np.unique(cells), np.arange(mesh.n_nodes))
volumes = np.prod(xyz[cells].max(axis=1) - xyz[cells].min(axis=1), axis=1)
expected_volume = np.sum((WIDTHS_MM / 2.)**2 * thickness)
assert np.all(volumes > 0) and np.isclose(volumes.sum(), expected_volume, rtol=1e-13)
out = ROOT / 'data' / 'mesh-l3-quarter.npz'
np.savez_compressed(out, xyz_default_mm=xyz, connectivity=cells, element_layer=layers,
    node_xy_mm=xyz[:, :2], node_z_layer=z_layer.astype(np.uint8), node_z_eta=z_eta,
    layer_ids=np.asarray(LAYER_IDS), default_thickness_mm=thickness,
    default_conductivity_W_per_mK=conductivities,
    top_flux_nodes=mesh.top_nodes, bottom_robin_nodes=np.flatnonzero(mesh.bottom_weights))
report = {'mesh_file': 'data/mesh-l3-quarter.npz', 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(),
    'nodes': mesh.n_nodes, 'hexahedra': mesh.n_elements, 'coordinate_units': 'mm',
    'domain': 'quarter: x >= 0, y >= 0; symmetry planes x=0 and y=0',
    'connectivity_order': 'tensor-product dz,dy,dx binary order; VTK order is [0,1,3,2,4,5,7,6]',
    'default_parameters': DEFAULTS, 'layer_ids_bottom_to_top': LAYER_IDS,
    'all_sample_reconstruction': 'x,y unchanged; z = cumulative_thickness[node_z_layer] + node_z_eta * sample_thickness[node_z_layer]',
    'default_volume_mm3': float(volumes.sum()), 'analytic_quarter_volume_mm3': float(expected_volume),
    'positive_element_volumes': True, 'all_nodes_referenced': True}
(ROOT / 'reports' / 'mesh-export-v2.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'nodes': mesh.n_nodes, 'elements': mesh.n_elements, 'bytes': out.stat().st_size, 'volume_mm3': float(volumes.sum())}))
