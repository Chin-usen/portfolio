"""Conforming Q1 hexahedral FEM for a stepped seven-layer quarter-domain.

Element matrices are exact tensor products of 1-D linear mass/stiffness matrices.
No analytic spreading-resistance approximation enters the FEM system.
"""
from __future__ import annotations
from dataclasses import dataclass
import time
import numpy as np
from scipy.sparse import coo_matrix, csr_matrix
from scipy.sparse.linalg import spsolve
from threadpoolctl import threadpool_limits

POWER_W = 100.0
SEED = 20261014
PARAMETERS = {
    't_cooler': (1., 5., 3.), 'k_cooler': (120., 400., 390.),
    't_sb': (.05, .3, .1), 'k_sb': (20., 250., 58.),
    't_cub': (.1, 1., .3), 't_cer': (.2, 1., .32), 'k_cer': (20., 200., 90.),
    't_cut': (.1, 1., .3), 'k_cu': (250., 400., 390.),
    't_st': (.05, .3, .08), 'k_st': (20., 250., 200.), 'h': (2000., 20000., 15000.),
}
KEYS = tuple(PARAMETERS)
DEFAULTS = {key: values[2] for key, values in PARAMETERS.items()}
MIDPOINT = {key: .5 * (values[0] + values[1]) for key, values in PARAMETERS.items()}
LAYER_IDS = ('cooler', 'solder-bottom', 'copper-bottom', 'ceramic', 'copper-top', 'solder-top', 'chip')
WIDTHS_MM = np.array([30., 10., 10., 12., 10., 5., 5.])
FIELD_ROWS = (16, 6, 8, 12, 8, 6, 8)

@dataclass(frozen=True)
class MeshLevel:
    name: str
    xy_counts: tuple[int, int, int, int]
    z_counts: tuple[int, int, int, int, int, int, int]

LEVELS = [
    MeshLevel('L1', (4, 4, 2, 7), (6, 3, 3, 3, 3, 3, 3)),
    MeshLevel('L2', (6, 6, 3, 10), (9, 4, 4, 4, 4, 4, 4)),
    MeshLevel('L3', (8, 8, 4, 14), (12, 6, 6, 6, 6, 6, 6)),
    MeshLevel('L4', (10, 10, 5, 18), (15, 8, 8, 8, 8, 8, 8)),
]

def physical_arrays(p):
    thickness_mm = np.array([p['t_cooler'], p['t_sb'], p['t_cub'], p['t_cer'], p['t_cut'], p['t_st'], .18])
    conductivities = np.array([p['k_cooler'], p['k_sb'], p['k_cu'], p['k_cer'], p['k_cu'], p['k_st'], 370.])
    return thickness_mm, conductivities


def analytic_resistance(p):
    """User-supplied 45-degree/circular formula; comparison only, never used in FEM."""
    thicknesses, conductivities = physical_arrays(p)
    side_mm = 5.
    resistance = 0.
    for j in range(6, 0, -1):
        end_mm = min(side_mm + 2 * thicknesses[j], WIDTHS_MM[j])
        resistance += thicknesses[j] * 1e3 / (conductivities[j] * side_mm * end_mm)
        side_mm = end_mm
    a = side_mm * 1e-3 / np.sqrt(np.pi)
    b = .03 / np.sqrt(np.pi)
    eps = a / b
    tau = p['t_cooler'] * 1e-3 / b
    bi = p['h'] * b / p['k_cooler']
    lam = np.pi + 1 / (np.sqrt(np.pi) * eps)
    tanh = np.tanh(lam * tau)
    phi = (tanh + lam / bi) / (1 + lam / bi * tanh)
    return resistance + (1 - eps)**1.5 * phi / (np.sqrt(np.pi) * p['k_cooler'] * a) + p['t_cooler'] * 1e-3 / (p['k_cooler'] * np.pi * b*b) + 1 / (p['h'] * np.pi*b*b)


def mass(length):
    return length / 6 * np.array([[2., 1.], [1., 2.]])


def stiffness(length):
    return np.array([[1., -1.], [-1., 1.]]) / length


class StackMesh:
    def __init__(self, level: MeshLevel):
        started = time.perf_counter()
        self.level = level
        boundaries = (0., 2.5, 5., 6., 15.)
        self.x_mm = np.concatenate([np.linspace(boundaries[i], boundaries[i+1], level.xy_counts[i], endpoint=False) for i in range(4)] + [np.array([15.])])
        self.xy_limits = [int(np.flatnonzero(np.isclose(self.x_mm, width / 2))[0]) for width in WIDTHS_MM]
        self.z_offsets = np.r_[0, np.cumsum(level.z_counts)]
        self.node_map = {}
        element_groups = []
        for layer, (limit, nz) in enumerate(zip(self.xy_limits, level.z_counts)):
            elements, sizes = [], []
            z_offset = int(self.z_offsets[layer])
            for iz in range(nz):
                for iy in range(limit):
                    for ix in range(limit):
                        nodes = []
                        for dz in (0, 1):
                            for dy in (0, 1):
                                for dx in (0, 1):
                                    key = (ix + dx, iy + dy, z_offset + iz + dz)
                                    if key not in self.node_map:
                                        self.node_map[key] = len(self.node_map)
                                    nodes.append(self.node_map[key])
                        elements.append(nodes)
                        sizes.append(((self.x_mm[ix+1]-self.x_mm[ix])*1e-3, (self.x_mm[iy+1]-self.x_mm[iy])*1e-3, 1./nz))
            element_groups.append((np.array(elements, dtype=np.int32), np.array(sizes)))
        self.n_nodes = len(self.node_map)
        self.n_elements = sum(len(elements) for elements, _ in element_groups)
        self.kxy, self.kz = [], []
        for elements, sizes in element_groups:
            row = np.repeat(elements, 8, axis=1).ravel()
            col = np.tile(elements, (1, 8)).ravel()
            xy_values, z_values = [], []
            cache = {}
            for hx, hy, hz in sizes:
                key = (round(hx, 12), round(hy, 12), round(hz, 12))
                if key not in cache:
                    mx, my, mz = mass(hx), mass(hy), mass(hz)
                    xy = np.kron(mz, np.kron(my, stiffness(hx))) + np.kron(mz, np.kron(stiffness(hy), mx))
                    zz = np.kron(stiffness(hz), np.kron(my, mx))
                    cache[key] = (xy.ravel(), zz.ravel())
                xy, zz = cache[key]
                xy_values.append(xy)
                z_values.append(zz)
            shape = (self.n_nodes, self.n_nodes)
            self.kxy.append(coo_matrix((np.concatenate(xy_values), (row, col)), shape=shape).tocsr())
            self.kz.append(coo_matrix((np.concatenate(z_values), (row, col)), shape=shape).tocsr())
        self.robin, self.bottom_weights = self.surface_matrix(z_level=0, limit=self.xy_limits[0])
        _, self.top_weights = self.surface_matrix(z_level=int(self.z_offsets[-1]), limit=self.xy_limits[-1])
        self.top_nodes = np.flatnonzero(self.top_weights)
        self.chip_quarter_area = self.top_weights.sum()
        self.load = self.top_weights * (POWER_W / (5e-3)**2)
        assert np.isclose(self.load.sum(), POWER_W/4)
        assert min(level.z_counts[1], level.z_counts[5]) >= 3
        self.axis_nodes = np.array([self.node_map[(0, 0, int(z))] for z in self.z_offsets])
        self.field_x_mm = np.linspace(-15., 15., 128, endpoint=False) + 30./256
        self.field_layer = np.repeat(np.arange(7), FIELD_ROWS)
        self.field_eta = np.concatenate([(np.arange(count)+.5)/count for count in FIELD_ROWS])
        self.field_mask = (np.abs(self.field_x_mm)[None, :] <= WIDTHS_MM[self.field_layer, None]/2).astype(np.uint8)
        self._make_field_interpolator()
        self.build_seconds = time.perf_counter()-started

    def surface_matrix(self, z_level, limit):
        rows, cols, vals = [], [], []
        weights = np.zeros(self.n_nodes)
        for iy in range(limit):
            for ix in range(limit):
                ids = np.array([self.node_map[(ix+dx, iy+dy, z_level)] for dy in (0,1) for dx in (0,1)])
                hx = (self.x_mm[ix+1]-self.x_mm[ix])*1e-3
                hy = (self.x_mm[iy+1]-self.x_mm[iy])*1e-3
                local = np.kron(mass(hy), mass(hx))
                rows.extend(np.repeat(ids,4)); cols.extend(np.tile(ids,4)); vals.extend(local.ravel())
                weights[ids] += hx*hy/4
        return coo_matrix((vals,(rows,cols)), shape=(self.n_nodes,self.n_nodes)).tocsr(), weights

    def _make_field_interpolator(self):
        indices = np.zeros((64,128,4), dtype=np.int32)
        weights = np.zeros((64,128,4))
        for row, (layer, eta) in enumerate(zip(self.field_layer, self.field_eta)):
            nz = self.level.z_counts[layer]
            iz = min(int(eta*nz), nz-1)
            fz = eta*nz - iz
            zindex = int(self.z_offsets[layer])+iz
            for col, x in enumerate(np.abs(self.field_x_mm)):
                if not self.field_mask[row,col]: continue
                ix = min(np.searchsorted(self.x_mm,x,side='right')-1,self.xy_limits[layer]-1)
                fx = (x-self.x_mm[ix])/(self.x_mm[ix+1]-self.x_mm[ix])
                indices[row,col] = [self.node_map[(ix,0,zindex)],self.node_map[(ix+1,0,zindex)],self.node_map[(ix,0,zindex+1)],self.node_map[(ix+1,0,zindex+1)]]
                weights[row,col] = [(1-fx)*(1-fz),fx*(1-fz),(1-fx)*fz,fx*fz]
        self.field_indices, self.field_weights = indices, weights

    def solve(self,p, include_field=True):
        thickness_mm, conductivities = physical_arrays(p)
        a = self.robin * p['h']
        for xy, zz, t_mm, k in zip(self.kxy,self.kz,thickness_mm,conductivities):
            t = t_mm*1e-3
            a = a + xy*(k*t) + zz*(k/t)
        started = time.perf_counter()
        with threadpool_limits(limits=1):
            temperature = spsolve(a.tocsc(), self.load, permc_spec='MMD_AT_PLUS_A')
        solve_seconds = time.perf_counter()-started
        residual = np.linalg.norm(a@temperature-self.load)/np.linalg.norm(self.load)
        heat_out = p['h']*np.dot(self.bottom_weights, temperature)
        heat_balance = abs(heat_out-POWER_W/4)/(POWER_W/4)
        if not np.all(np.isfinite(temperature)) or residual>1e-7 or heat_balance>1e-7:
            raise RuntimeError(f'FEM verification failed residual={residual} balance={heat_balance}')
        interfaces = temperature[self.axis_nodes]/POWER_W
        result = dict(Rjmax=float(temperature[self.top_nodes].max()/POWER_W), Rjavg=float(np.dot(self.top_weights,temperature)/self.chip_quarter_area/POWER_W), interface_axis_K_per_W=interfaces, layer_drop_K_per_W=np.diff(interfaces), residual_rel=float(residual), heat_balance_rel=float(heat_balance), heat_out_quarter_W=float(heat_out), solve_seconds=solve_seconds)
        if include_field:
            result['field_K_per_W'] = (np.sum(temperature[self.field_indices]*self.field_weights,axis=-1)/POWER_W).astype(np.float32)
            boundaries = np.r_[0.,np.cumsum(thickness_mm)]
            result['field_z_mm'] = boundaries[self.field_layer]+self.field_eta*thickness_mm[self.field_layer]
        return result