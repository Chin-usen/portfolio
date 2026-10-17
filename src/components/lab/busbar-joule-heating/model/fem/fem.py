"""Self-written 3-D finite-element solver for the S2 busbar Joule-heating page.

Sequentially coupled, steady, constant-property problems on one conductor body:

1. Electric potential:  div(sigma grad V) = 0.  V = 1 on the terminal washer patch, V = 0 on the
   active pin patches, all other surfaces insulated. Solved with sigma = 1 S/m, so the computed
   terminal current I1 gives the geometric resistance R_g = 1 / I1 (1/m) and R = R_g / sigma.
2. Steady heat conduction:  k lap(T) + q = 0 with q = sigma |grad V|^2. In normalized form
   lap(Theta) + |grad V1|^2 = 0, -dTheta/dn = beta Theta on exposed faces (beta = h / k),
   Theta = 0 on every soldered pin patch (substrate temperature T_sub, also the ambient
   reference). Then T - T_sub = I^2 R_g^2 / (sigma k) * Theta  (exact for constant properties).

Discretization: trilinear 8-node hexahedra on a rectilinear grid fitted to every box, contact
patch and bolt-hole bounding line. Coordinates are metres inside the solver. No third-party
FEM package is used; numpy assembles the sparse matrices and scipy factorizes them.
"""
from __future__ import annotations

from dataclasses import dataclass
import math

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla

MM = 1e-3
AXES = {"x": 0, "y": 1, "z": 2}

# 1-D linear element matrices on a unit interval (scaled per element below).
_S1 = np.array([[1.0, -1.0], [-1.0, 1.0]])
_M1 = np.array([[2.0, 1.0], [1.0, 2.0]]) / 6.0
_BITS = np.array([[n & 1, (n >> 1) & 1, (n >> 2) & 1] for n in range(8)])


def _kron3(a, b, c):
    out = np.empty((8, 8))
    for n in range(8):
        for m in range(8):
            out[n, m] = (
                a[_BITS[n, 0], _BITS[m, 0]] * b[_BITS[n, 1], _BITS[m, 1]] * c[_BITS[n, 2], _BITS[m, 2]]
            )
    return out


_KX = _kron3(_S1, _M1, _M1)
_KY = _kron3(_M1, _S1, _M1)
_KZ = _kron3(_M1, _M1, _S1)


@dataclass
class Mesh:
    lines: tuple[np.ndarray, np.ndarray, np.ndarray]  # grid lines, metres
    active: np.ndarray  # (nx, ny, nz) bool cell mask
    cells: np.ndarray  # (ne, 3) active cell indices
    elem_nodes: np.ndarray  # (ne, 8) dof numbers
    node_ijk: np.ndarray  # (nn, 3) grid indices of dofs
    node_xyz: np.ndarray  # (nn, 3) metres
    node_index: np.ndarray  # (nx+1, ny+1, nz+1) dof number or -1
    sizes: np.ndarray  # (ne, 3) element sizes, metres

    @property
    def n_nodes(self) -> int:
        return len(self.node_xyz)


def _breakpoints(conductor, axis):
    values = set()
    for item in conductor["boxes"]:
        values.add(item["min"][axis])
        values.add(item["max"][axis])
        hole = item.get("hole")
        if hole and axis != 1:
            c = hole["x"] if axis == 0 else hole["z"]
            values.update((c - hole["radius"], c + hole["radius"], c))
    patches = [conductor["terminal"], *conductor["pins"]]
    for patch in patches:
        values.add(patch["min"][axis])
        values.add(patch["max"][axis])
    return np.array(sorted(values))


def build_mesh(conductor, h_max_mm: float, n_thin: int) -> Mesh:
    """Conductor-fitted rectilinear grid. Each box receives at least n_thin cells across every
    dimension and no spacing exceeds h_max_mm."""
    lines = []
    boxes = conductor["boxes"]
    for axis in range(3):
        points = _breakpoints(conductor, axis)
        points = points[np.concatenate(([True], np.diff(points) > 1e-9))]
        grid = [points[0]]
        for a, b in zip(points[:-1], points[1:]):
            mid = 0.5 * (a + b)
            spacing = h_max_mm
            for item in boxes:
                lo, hi = item["min"][axis], item["max"][axis]
                if lo - 1e-9 <= mid <= hi + 1e-9:
                    spacing = min(spacing, (hi - lo) / n_thin)
            count = max(1, int(math.ceil((b - a) / spacing - 1e-9)))
            grid.extend(a + (b - a) * np.arange(1, count + 1) / count)
        lines.append(np.array(grid))
    centers = [0.5 * (line[1:] + line[:-1]) for line in lines]
    cx, cy, cz = np.meshgrid(*centers, indexing="ij")
    active = np.zeros(cx.shape, dtype=bool)
    for item in boxes:
        inside = (
            (cx > item["min"][0]) & (cx < item["max"][0])
            & (cy > item["min"][1]) & (cy < item["max"][1])
            & (cz > item["min"][2]) & (cz < item["max"][2])
        )
        hole = item.get("hole")
        if hole:
            inside &= (cx - hole["x"]) ** 2 + (cz - hole["z"]) ** 2 >= hole["radius"] ** 2
        active |= inside
    # A box covered by a hole of another box (terminal foot under the upright) stays solid.
    for item in boxes:
        hole = item.get("hole")
        if not hole:
            continue
        in_hole = (
            (cy > item["min"][1]) & (cy < item["max"][1])
            & ((cx - hole["x"]) ** 2 + (cz - hole["z"]) ** 2 < hole["radius"] ** 2)
        )
        others = np.zeros_like(active)
        for other in boxes:
            if other is item:
                continue
            others |= (
                (cx > other["min"][0]) & (cx < other["max"][0])
                & (cy > other["min"][1]) & (cy < other["max"][1])
                & (cz > other["min"][2]) & (cz < other["max"][2])
            )
        active &= ~(in_hole & ~others)
    cells = np.argwhere(active)
    shape = tuple(len(line) for line in lines)
    corner = np.zeros(shape, dtype=bool)
    for bits in _BITS:
        corner[cells[:, 0] + bits[0], cells[:, 1] + bits[1], cells[:, 2] + bits[2]] = True
    node_ijk = np.argwhere(corner)
    node_index = -np.ones(shape, dtype=np.int64)
    node_index[tuple(node_ijk.T)] = np.arange(len(node_ijk))
    elem_nodes = np.stack(
        [node_index[cells[:, 0] + b[0], cells[:, 1] + b[1], cells[:, 2] + b[2]] for b in _BITS], axis=1
    )
    lines_m = tuple(line * MM for line in lines)
    node_xyz = np.stack([lines_m[a][node_ijk[:, a]] for a in range(3)], axis=1)
    sizes = np.stack([np.diff(lines_m[a])[cells[:, a]] for a in range(3)], axis=1)
    return Mesh(lines_m, active, cells, elem_nodes, node_ijk, node_xyz, node_index, sizes)


def stiffness(mesh: Mesh) -> sp.csr_matrix:
    dx, dy, dz = mesh.sizes.T
    blocks = (
        (dy * dz / dx)[:, None, None] * _KX
        + (dx * dz / dy)[:, None, None] * _KY
        + (dx * dy / dz)[:, None, None] * _KZ
    )
    rows = np.repeat(mesh.elem_nodes, 8, axis=1).ravel()
    cols = np.tile(mesh.elem_nodes, (1, 8)).ravel()
    n = mesh.n_nodes
    return sp.csr_matrix((blocks.ravel(), (rows, cols)), shape=(n, n))


def boundary_mass(mesh: Mesh) -> sp.csr_matrix:
    """Consistent mass matrix of every exposed face of the active cell set (area in m^2)."""
    active = mesh.active
    rows, cols, data = [], [], []
    m2 = np.kron(_M1, _M1)
    for axis in range(3):
        for side in (0, 1):
            shift = np.zeros(3, dtype=int)
            shift[axis] = 1 if side else -1
            neighbour = mesh.cells + shift
            outside = (neighbour[:, axis] < 0) | (neighbour[:, axis] >= active.shape[axis])
            exposed = outside.copy()
            inside = ~outside
            exposed[inside] = ~active[tuple(neighbour[inside].T)]
            idx = np.nonzero(exposed)[0]
            if not len(idx):
                continue
            others = [a for a in range(3) if a != axis]
            local = [n for n in range(8) if _BITS[n, axis] == side]
            # local ordering on the face follows (others[0], others[1]) bits, matching kron(M1, M1)
            local.sort(key=lambda n: (_BITS[n, others[1]], _BITS[n, others[0]]))
            nodes = mesh.elem_nodes[idx][:, local]
            area = mesh.sizes[idx, others[0]] * mesh.sizes[idx, others[1]]
            blocks = area[:, None, None] * m2
            rows.append(np.repeat(nodes, 4, axis=1).ravel())
            cols.append(np.tile(nodes, (1, 4)).ravel())
            data.append(blocks.ravel())
    n = mesh.n_nodes
    return sp.csr_matrix(
        (np.concatenate(data), (np.concatenate(rows), np.concatenate(cols))), shape=(n, n)
    )


def patch_nodes(mesh: Mesh, patch) -> np.ndarray:
    axis = AXES[patch["axis"]]
    xyz = mesh.node_xyz / MM
    tol = 1e-7
    mask = np.abs(xyz[:, axis] - patch["value"]) < tol
    for a in range(3):
        if a == axis:
            continue
        mask &= (xyz[:, a] >= patch["min"][a] - tol) & (xyz[:, a] <= patch["max"][a] + tol)
    if patch.get("innerRadius"):
        center = np.array(patch["center"])
        others = [a for a in range(3) if a != axis]
        r2 = sum((xyz[:, a] - center[a]) ** 2 for a in others)
        mask &= r2 >= (patch["innerRadius"] - tol) ** 2
    nodes = np.nonzero(mask)[0]
    if not len(nodes):
        raise ValueError(f"Contact patch {patch['id']} has no mesh nodes")
    return nodes


def _solve_dirichlet(matrix, rhs, fixed, values):
    n = matrix.shape[0]
    free = np.setdiff1d(np.arange(n), fixed)
    x = np.zeros(n)
    x[fixed] = values
    reduced = matrix[free][:, free].tocsc()
    b = rhs[free] - matrix[free][:, fixed] @ x[fixed]
    x[free] = spla.spsolve(reduced, b, permc_spec="COLAMD")
    return x


# 2x2x2 Gauss rule on the unit cube.
_G = np.array([0.5 - 0.5 / math.sqrt(3.0), 0.5 + 0.5 / math.sqrt(3.0)])
_GP = np.array([[a, b, c] for c in _G for b in _G for a in _G])


def _shape(s):
    """Shape values (8,) and unit-cube derivatives (3, 8) at local point s."""
    n = np.empty(8)
    d = np.empty((3, 8))
    for k, bits in enumerate(_BITS):
        f = [s[a] if bits[a] else 1.0 - s[a] for a in range(3)]
        df = [1.0 if bits[a] else -1.0 for a in range(3)]
        n[k] = f[0] * f[1] * f[2]
        d[0, k] = df[0] * f[1] * f[2]
        d[1, k] = f[0] * df[1] * f[2]
        d[2, k] = f[0] * f[1] * df[2]
    return n, d


_SHAPES = [_shape(s) for s in _GP]
_CENTER_D = _shape(np.array([0.5, 0.5, 0.5]))[1]


def electric(mesh: Mesh, stiff, terminal_nodes, ground_nodes):
    """Unit-potential solution with sigma = 1. Returns V, current I1 and element gradients."""
    fixed = np.concatenate([terminal_nodes, ground_nodes])
    values = np.concatenate([np.ones(len(terminal_nodes)), np.zeros(len(ground_nodes))])
    v = _solve_dirichlet(stiff, np.zeros(mesh.n_nodes), fixed, values)
    reaction = stiff @ v
    current = float(reaction[terminal_nodes].sum())
    joule = float(v @ (stiff @ v))
    return v, current, joule


def joule_load(mesh: Mesh, v):
    """Consistent nodal load f_i = integral N_i |grad V|^2 dV (2x2x2 Gauss)."""
    ve = v[mesh.elem_nodes]
    inv = 1.0 / mesh.sizes
    vol = mesh.sizes.prod(axis=1)
    load = np.zeros((len(ve), 8))
    total = np.zeros(len(ve))
    for n, d in _SHAPES:
        grad = (ve @ d.T) * inv
        q = (grad**2).sum(axis=1)
        w = vol / 8.0
        load += (q * w)[:, None] * n[None, :]
        total += q * w
    f = np.bincount(mesh.elem_nodes.ravel(), weights=load.ravel(), minlength=mesh.n_nodes)
    return f, float(total.sum())


def nodal_gradient(mesh: Mesh, v):
    """Volume-weighted average of element-centre gradient vectors at nodes, magnitude 1/m."""
    ve = v[mesh.elem_nodes]
    grad = (ve @ _CENTER_D.T) / mesh.sizes
    vol = mesh.sizes.prod(axis=1)
    acc = np.zeros((mesh.n_nodes, 3))
    weight = np.bincount(mesh.elem_nodes.ravel(), weights=np.repeat(vol, 8), minlength=mesh.n_nodes)
    for a in range(3):
        acc[:, a] = np.bincount(
            mesh.elem_nodes.ravel(), weights=np.repeat(grad[:, a] * vol, 8), minlength=mesh.n_nodes
        )
    return np.linalg.norm(acc / weight[:, None], axis=1)


def thermal(mesh: Mesh, stiff, mass, load, pin_nodes, beta):
    """Normalized temperature rise Theta for beta = h/k (1/m)."""
    matrix = (stiff + beta * mass).tocsr()
    return _solve_dirichlet(matrix, load, pin_nodes, np.zeros(len(pin_nodes)))


def interpolator(mesh: Mesh, points_mm):
    """Trilinear interpolation operator (node ids, weights) at points (mm). Points on shared faces
    take an active neighbouring cell; points in voids (bolt hole) take the nearest active cell."""
    pts = np.asarray(points_mm, dtype=float) * MM
    lines = mesh.lines
    shape = mesh.active.shape
    node_ids = np.empty((len(pts), 8), dtype=np.int64)
    weights_all = np.empty((len(pts), 8))
    for p_index, p in enumerate(pts):
        candidates = []
        for a in range(3):
            line = lines[a]
            i = int(np.searchsorted(line, p[a], side="right") - 1)
            i = min(max(i, 0), shape[a] - 1)
            options = {i}
            if abs(p[a] - line[i]) < 1e-12 and i > 0:
                options.add(i - 1)
            if i + 1 < len(line) and abs(p[a] - line[i + 1]) < 1e-12:
                options.add(min(i + 1, shape[a] - 1))
            candidates.append(sorted(options))
        cell = None
        for i in candidates[0]:
            for j in candidates[1]:
                for k in candidates[2]:
                    if mesh.active[i, j, k]:
                        cell = (i, j, k)
                        break
                if cell:
                    break
            if cell:
                break
        if cell is None:
            # Nearest active cell centre (hole interior, used only for hidden display vertices).
            centers = np.stack(
                [0.5 * (lines[a][mesh.cells[:, a]] + lines[a][mesh.cells[:, a] + 1]) for a in range(3)],
                axis=1,
            )
            nearest = int(np.argmin(((centers - p) ** 2).sum(axis=1)))
            cell = tuple(mesh.cells[nearest])
        lo = np.array([lines[a][cell[a]] for a in range(3)])
        hi = np.array([lines[a][cell[a] + 1] for a in range(3)])
        s = np.clip((p - lo) / (hi - lo), 0.0, 1.0)
        node_ids[p_index] = [
            mesh.node_index[cell[0] + b[0], cell[1] + b[1], cell[2] + b[2]] for b in _BITS
        ]
        weights_all[p_index] = _shape(s)[0]
    return node_ids, weights_all


def apply(operator, values):
    node_ids, weights = operator
    return (values[node_ids] * weights).sum(axis=1)


def lattice_points(conductor):
    """Display lattice points in the same order as geometry.ts latticePoint/latticeOffsets."""
    points = []
    for item in conductor["boxes"]:
        nx, ny, nz = item["lattice"]
        lo, hi = np.array(item["min"]), np.array(item["max"])
        for k in range(nz + 1):
            for j in range(ny + 1):
                for i in range(nx + 1):
                    points.append(lo + (hi - lo) * np.array([i / nx, j / ny, k / nz]))
    return np.array(points)


@dataclass
class ConductorSolution:
    resistance_g: float  # 1/m, R = resistance_g / sigma
    theta_max: dict  # beta -> max nodal Theta
    theta_field: dict  # beta -> lattice Theta
    j_field: np.ndarray  # lattice R_g |grad V1| (1/m^2); J = I * j_field
    joule_check: float  # relative mismatch between I1*V0, V'KV and Gauss integral
    n_nodes: int
    n_elements: int


def solve_conductor(conductor, ground_ids, betas, h_max_mm=1.0, n_thin=2, want_fields=True):
    mesh = build_mesh(conductor, h_max_mm, n_thin)
    stiff = stiffness(mesh)
    mass = boundary_mass(mesh)
    terminal = patch_nodes(mesh, conductor["terminal"])
    pins = {pin["id"]: patch_nodes(mesh, pin) for pin in conductor["pins"]}
    ground = np.unique(np.concatenate([pins[i] for i in ground_ids]))
    all_pins = np.unique(np.concatenate(list(pins.values())))
    v, current, energy = electric(mesh, stiff, terminal, ground)
    load, gauss = joule_load(mesh, v)
    check = max(abs(energy - current), abs(gauss - current)) / current
    rg = 1.0 / current
    operator = interpolator(mesh, lattice_points(conductor)) if want_fields else None
    theta_max, theta_field = {}, {}
    for beta in betas:
        theta = thermal(mesh, stiff, mass, load, all_pins, beta)
        theta_max[beta] = float(theta.max())
        if want_fields:
            theta_field[beta] = apply(operator, theta)
    j_field = None
    if want_fields:
        j_field = rg * apply(operator, nodal_gradient(mesh, v))
    return ConductorSolution(rg, theta_max, theta_field, j_field, check, mesh.n_nodes, len(mesh.cells))
