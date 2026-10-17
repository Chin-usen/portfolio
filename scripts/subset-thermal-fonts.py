"""Build exact-outline, actual-weight Noto subsets for the S1 interface only.

Uses the same pinned toolchain and provenance checks as subset-noto-fonts.py.
The route-scoped CSS uses checked local subsets; changed copy requires regeneration.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.unicodedata import mirrored

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("base_subsetter", ROOT / "scripts/subset-noto-fonts.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
input_spec = importlib.util.spec_from_file_location("lab_font_inputs", ROOT / "scripts/lab-font-inputs.py")
lab_inputs = importlib.util.module_from_spec(input_spec)
input_spec.loader.exec_module(lab_inputs)
OUTPUT = ROOT / "public/fonts"
MANIFEST = OUTPUT / "noto-sans-sc-thermal-manifest.json"
CSS = ROOT / "src/components/lab/thermal-stack/thermal-fonts.css"
CURRENT_INPUTS = {}


def requested_by_weight() -> dict[int, set[int]]:
    copy = (ROOT / "src/components/lab/thermal-stack/copy.ts").read_text(encoding="utf-8")
    copy = copy.split("  en: {", 1)[0]
    dictionary = (ROOT / "src/i18n/dictionaries.ts").read_text(encoding="utf-8")
    home = json.loads((ROOT / "src/content/home/zh.json").read_text(encoding="utf-8"))
    nav = "".join(str(home.get(key, "")) for key in ("name", "navWork", "navLab"))
    for key in ("nav", "common"):
        nav += re.search(r"  " + key + r": \{(.*?)\n  \},", dictionary, re.S)[1]
    shared = nav + json.dumps(home["footer"], ensure_ascii=False)
    for component in ("Header", "Footer"):
        shared += (ROOT / f"src/components/{component}.astro").read_text(encoding="utf-8")

    def values(keys: list[str]) -> str:
        result = ""
        for key in keys:
            match = re.search(r"    " + key + r": (?:'([^']*)'|\{(.*?)\n    \})", copy, re.S)
            if match is None:
                raise ValueError(f"Review font coverage after copy structure changes: {key}")
            result += match[1] or match[2]
        return result

    # Four real weights. The 500/600/700 rules reflect the selectors in thermal.css:
    # resistance caption; selected tabs/model buttons + card/section headings; H1.
    source = {
        400: copy + shared + (ROOT / "src/components/lab/thermal-stack/ThermalStack.astro").read_text(encoding="utf-8"),
        500: nav + values(["resistanceTitle", "femResistanceTitle"]),
        600: nav + values(["eyebrow", "tabs", "layerNames", "modelAnalytic", "modelFem", "parameterTitle", "modelLabel", "femLabel", "validationLabel"]),
        700: nav + values(["title"]),
    }
    CURRENT_INPUTS.clear()
    source[400] += lab_inputs.component_text("thermal-stack", CURRENT_INPUTS)
    requested = {}
    for weight, text in source.items():
        codes = {ord(character) for character in text if ord(character) > 127}
        codes |= {mirror for code in tuple(codes) if (mirror := mirrored(code)) is not None}
        requested[weight] = codes
    return requested


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if base.fontTools.__version__ != base.FONTTOOLS_VERSION or base.brotli.__version__ != base.BROTLI_VERSION:
        raise SystemExit("Use scripts/font-subset-requirements.txt")
    package = json.loads((base.PACKAGE / "package.json").read_text(encoding="utf-8"))
    assert package["version"] == "5.3.1"
    assert (OUTPUT / "OFL.txt").read_bytes() == (base.PACKAGE / "LICENSE").read_bytes(), "Restore the exact locked font license bytes"
    if args.check:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        requested = requested_by_weight()
        assert lab_inputs.decode_bindings(manifest["sourceInputsSha256"]) == CURRENT_INPUTS, "S1 source changed; regenerate thermal fonts"
        for face in manifest["faces"]:
            source, output = base.PACKAGE / face["source"], OUTPUT / face["file"]
            assert base.digest(source.read_bytes()) == face["sourceSha256"]
            assert base.digest(output.read_bytes()) == face["sha256"]
            assert output.stat().st_size == face["bytes"]
            with TTFont(source, recalcTimestamp=False) as original:
                expected = requested[face["weight"]] & set(original.getBestCmap())
            assert expected == {int(code[2:], 16) for code in face["codepoints"]}, "S1 copy changed; regenerate thermal fonts"
            base.verify_face(source, output, {int(code[2:], 16) for code in face["codepoints"]}, face["weight"])
        assert base.digest((OUTPUT / "OFL.txt").read_bytes()) == manifest["license"]["sha256"]
        print(f"PASS: {len(manifest['faces'])} S1 font faces; exact glyph outlines, weights, metrics, cmap and provenance")
        return

    faces = []
    css = ["/* Generated by scripts/subset-thermal-fonts.py; only thermal-page selects this family. */"]
    for weight, codes in requested_by_weight().items():
        source_relative = f"files/noto-sans-sc-chinese-simplified-{weight}-normal.woff2"
        source = base.PACKAGE / source_relative
        with TTFont(source, recalcTimestamp=False) as font:
            coverage = codes & set(font.getBestCmap())
            options = subset.Options()
            options.flavor = "woff2"
            options.recalc_timestamp = False
            options.layout_features = ["*"]
            options.name_IDs = ["*"]
            options.name_languages = ["*"]
            options.name_legacy = True
            options.glyph_names = True
            options.hinting = True
            subsetter = subset.Subsetter(options=options)
            subsetter.populate(unicodes=coverage)
            subsetter.subset(font)
            font.flavor = "woff2"
            output = OUTPUT / f"noto-sans-sc-thermal-{weight}-normal.woff2"
            font.save(output, reorderTables=True)
        base.verify_face(source, output, coverage, weight)
        face = {
            "weight": weight,
            "source": source_relative,
            "sourceSha256": base.digest(source.read_bytes()),
            "file": output.name,
            "bytes": output.stat().st_size,
            "sha256": base.digest(output.read_bytes()),
            "codepoints": base.codepoints(coverage),
            "fallbackCodepoints": base.codepoints(codes - coverage),
        }
        faces.append(face)
        css.append("@font-face {\n  font-family: 'Noto Sans SC Thermal';\n  font-style: normal;\n  font-display: optional;\n  font-weight: " + str(weight) + ";\n  src: url('/fonts/" + output.name + "') format('woff2');\n  unicode-range: " + ",".join(face["codepoints"]) + ";\n}")
        print(f"{weight}: {face['bytes']} bytes / {len(coverage)} glyphs, exact outlines verified")
    manifest = {
        "format": "noto-thermal-subsets-v1",
        "package": "@fontsource/noto-sans-sc",
        "packageVersion": package["version"],
        "license": {"spdx": "OFL-1.1", "file": "OFL.txt", "sha256": base.digest((OUTPUT / "OFL.txt").read_bytes())},
        "tools": {"fonttools": base.FONTTOOLS_VERSION, "brotli": base.BROTLI_VERSION},
        "sourceInputsSha256": lab_inputs.encode_bindings(CURRENT_INPUTS),
        "coverageRule": "Thermal interface strings by actual CSS weight plus shared navigation; see requested_by_weight(). Latin remains Geist; symbols outside the original master use the system stack. Changed bound copy must pass regeneration and coverage checks.",
        "faces": faces,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    CSS.write_text("\n".join(css) + "\n", encoding="utf-8", newline="\n")
    print(f"Total: {sum(face['bytes'] for face in faces)} bytes")


if __name__ == "__main__":
    main()
