"""Shared paths, ranges and geometry access for the S2 offline FEM pipeline."""
from __future__ import annotations

import hashlib
import json
import math
import os
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
COMPONENT = HERE.parents[1]
ROOT = HERE.parents[5]
DATA = HERE / "data"
REPORTS = HERE / "reports"
PUBLIC = ROOT / "public/models/busbar-joule-heating"
EXPORT_SCRIPT = HERE.parent / "export-geometry.mjs"
L1_PARAMS = ROOT / "model/l1-half-bridge/params.json"

# Input domain of the page (geometry and the single thermal group beta = h / k).
T_RANGE = (0.5, 3.0)  # conductor thickness, mm
B_RANGE = (2.0, 6.0)  # strap width, mm
H_RANGE = (5.0, 500.0)  # W/(m^2 K)
K_RANGE = (100.0, 400.0)  # W/(m K), custom material bound; presets lie inside
BETA_RANGE = (H_RANGE[0] / K_RANGE[1], H_RANGE[1] / K_RANGE[0])  # 1/m: 0.0125 .. 5
# Production mesh: maximum spacing and minimum cells across every box dimension.
PRODUCTION_MESH = {"h_max_mm": 0.75, "n_thin": 2}

# Conductor-state pairs that carry current; field outputs are produced for these four.
CASES = [
    ("sh", "p-layer"),
    ("sh", "ac-link"),
    ("sl", "ac-link"),
    ("sl", "n-layer"),
]


def case_key(state, conductor):
    return f"{state}:{conductor}"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def node_binary() -> str:
    return os.environ.get("NODE", "node")


def export_geometries(inputs):
    """Run the TypeScript geometry module (single source, reads L1 params.json) for inputs."""
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "in.json"
        dst = Path(tmp) / "out.json"
        src.write_text(json.dumps(inputs), encoding="utf-8")
        subprocess.run(
            [node_binary(), "--experimental-strip-types", str(EXPORT_SCRIPT), str(src), str(dst)],
            cwd=ROOT,
            check=True,
        )
        return json.loads(dst.read_text(encoding="utf-8"))


def ground_pins(active_paths, state, conductor):
    for item in active_paths[state]:
        if item["conductor"] == conductor:
            return item["pins"]
    raise KeyError((state, conductor))


def to_unit(value, lo, hi):
    """Logarithmic normalization used by every surrogate input."""
    return (math.log(value) - math.log(lo)) / (math.log(hi) - math.log(lo))


def from_unit(u, lo, hi):
    return math.exp(math.log(lo) + u * (math.log(hi) - math.log(lo)))


def prettier(*paths: Path):
    """Format generated JSON with the repository's pinned Prettier (checked by pnpm lint)."""
    subprocess.run(
        [node_binary(), str(ROOT / "node_modules/prettier/bin/prettier.cjs"), "--write", *map(str, paths)],
        cwd=ROOT,
        check=True,
        stdout=subprocess.DEVNULL,
    )


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    prettier(path)
