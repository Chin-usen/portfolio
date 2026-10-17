"""Build exact-outline Noto subsets for the L1 half-bridge interface.

Optional authoring tool, using the same pinned provenance checks as the global
and S1 generators. Normal Node builds consume the checked-in output files.
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
OUTPUT = ROOT / "public/fonts"
MANIFEST = OUTPUT / "noto-sans-sc-half-bridge-manifest.json"
CSS = ROOT / "src/components/lab/half-bridge/half-bridge-fonts.css"
FAMILY = "Noto Sans SC Half Bridge"

# Existing rules are intentionally retained, including the UA bold h1/h2/h3.
WEIGHT_RULES = {
    400: "All L1 copy, every part's descriptions/materials and secondary name; unselected controls; shared shell, footer, skip link and language links.",
    500: "Inactive shared desktop navigation (.n1-nav-list a). L1 controls inherit 400, not 500.",
    600: "Site name and active desktop navigation; .l1-kicker; selected modes, part buttons and leader labels; .l1-loop-label and .l1-flow-path strong.",
    700: "L1 h1 and part-name h2 retain UA bold; noscript h2/h3; shared mobile navigation (.n1-menu-links a).",
}


def coverage_inputs() -> tuple[dict[int, set[int]], dict[str, str]]:
    inputs = {}

    def read(relative: str) -> str:
        path = ROOT / relative
        inputs[relative] = base.digest(path.read_bytes())
        return path.read_text(encoding="utf-8")

    copy = read("src/components/lab/half-bridge/copy.ts").split("  en: {", 1)[0]
    component = read("src/components/lab/half-bridge/HalfBridge.astro")
    # The L1 shell is composed from these shared components. Include every markup
    # input in the source binding, while retaining the same rendered glyph set.
    for name in ("DisassemblyPage", "StageCard", "SelectedPartCard", "PartTags"):
        component += read(f"src/components/lab/_shared/disassembly/{name}.astro")
    dictionary = read("src/i18n/dictionaries.ts")
    home = json.loads(read("src/content/home/zh.json"))
    nav_match = re.search(r"  nav: \{(.*?)\n  \},", dictionary, re.S)
    common_match = re.search(r"  common: \{(.*?)\n  \},", dictionary, re.S)
    if not nav_match or not common_match:
        raise ValueError("Review shared navigation coverage after dictionary structure change")
    nav = home["navWork"] + home["navLab"] + nav_match[1]
    shared = nav + home["name"] + common_match[1] + json.dumps(home["footer"], ensure_ascii=False)
    for name in ("Header", "Footer"):
        shared += read(f"src/components/{name}.astro")
    parts = [json.loads(read(path.relative_to(ROOT).as_posix()))
             for path in sorted((ROOT / "src/content/halfBridgeParts").glob("*.json"))]
    if len(parts) != 10:
        raise ValueError("Review part-count coverage after collection structure change")

    def values(keys: list[str]) -> str:
        result = []
        for key in keys:
            match = re.search(r"^    " + key + r":\s*'([^']*)'", copy, re.M)
            if match is None:
                raise ValueError(f"Review L1 font coverage after copy structure changes: {key}")
            result.append(match[1])
        return "".join(result)

    # Include the relevant CSS in the source binding, and fail if the specific
    # reviewed weight rules move. Future CSS edits require reviewing this map.
    css = read("src/components/lab/_shared/disassembly/disassembly.css")
    css += read("src/components/lab/half-bridge/half-bridge.css")
    navigation = read("src/styles/navigation.css")
    global_css = read("src/styles/global.css")
    read("src/styles/thermal-tokens.css")
    read("src/styles/tokens.css")
    read("src/layouts/BaseLayout.astro")
    for selector in (".l1-kicker", ".l1-modes button[aria-pressed='true']",
                     ".l1-labels button[aria-pressed='true']", ".l1-parts button[aria-pressed='true']",
                     ".l1-loop-label", ".l1-flow-path strong"):
        block = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", css)
        assert block and re.search(r"font-weight:\s*600\s*;", block[1]), selector
    for selector, weight in ((".n1-nav-list a", 500), (".n1-menu-links a", 700)):
        block = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", navigation)
        assert block and re.search(r"font-weight:\s*" + str(weight) + r"\s*;", block[1]), selector
    # A bold h1/h2/h3 comes from the browser stylesheet; current styles do not
    # override their weight. This check prevents silently using an outdated map.
    for block in re.finditer(r"([^{}]+)\{([^{}]*)\}", css + global_css):
        if re.search(r"(?:^|[\s,])h[123](?:\s|,|$)", block[1]):
            assert "font-weight" not in block[2], "Review heading font-weight coverage"
    source = {
        400: copy + component + shared + json.dumps(parts, ensure_ascii=False),
        500: nav,
        600: nav + home["name"] + values(["kicker", "assembled", "exploded", "commutation", "loop"])
             + "".join(part["shortZh"] for part in parts),
        700: nav + values(["title", "allParts"]) + "".join(part["nameZh"] for part in parts),
    }
    requested = {}
    for weight, text in source.items():
        codes = {ord(character) for character in text if ord(character) > 127}
        codes |= {mirror for code in tuple(codes) if (mirror := mirrored(code)) is not None}
        requested[weight] = codes
    return requested, inputs


def verify_css(faces: list[dict]) -> None:
    blocks = re.findall(r"@font-face\s*\{(.*?)\}", CSS.read_text(encoding="utf-8"), re.S)
    assert len(blocks) == 4
    for face, block in zip(faces, blocks, strict=True):
        assert f"font-family: '{FAMILY}'" in block
        assert f"font-weight: {face['weight']}" in block
        assert "font-display: swap" in block
        assert f"/fonts/{face['file']}" in block
        ranges = re.search(r"unicode-range:\s*([^;]+)", block)[1]
        assert set(re.findall(r"U\+[0-9A-F]+", ranges)) == set(face["codepoints"])


def report(manifest: dict, requested: dict[int, set[int]], inputs: dict[str, str]) -> dict:
    return {
        "status": "passed",
        "scope": "Exact source-font coverage and asset verification; no browser or Lighthouse claim",
        "package": "@fontsource/noto-sans-sc@5.3.1",
        "tools": manifest["tools"],
        "sourceInputsSha256": inputs,
        "manifestSha256": base.digest(MANIFEST.read_bytes()),
        "cssSha256": base.digest(CSS.read_bytes()),
        "totalBytes": sum(face["bytes"] for face in manifest["faces"]),
        "checks": ["Every retained glyph outline equals the original", "Advance and vertical metrics unchanged",
                   "Four original weights 400/500/600/700", "Exact original name/copyright/license metadata",
                   "Actual source copy mapped by existing CSS weights", "All requested CJK codepoints covered",
                   "CSS face ranges match verified cmap", "Original global Noto fallback retained"],
        "weightRules": WEIGHT_RULES,
        "faces": [{**face, "requestedCodepoints": base.codepoints(requested[face["weight"]])}
                  for face in manifest["faces"]],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--report", type=Path, help="Optional external verification JSON path")
    args = parser.parse_args()
    if base.fontTools.__version__ != base.FONTTOOLS_VERSION or base.brotli.__version__ != base.BROTLI_VERSION:
        raise SystemExit("Use scripts/font-subset-requirements.txt")
    package = json.loads((base.PACKAGE / "package.json").read_text(encoding="utf-8"))
    assert package["version"] == "5.3.1"
    assert (OUTPUT / "OFL.txt").read_bytes() == (base.PACKAGE / "LICENSE").read_bytes()
    requested, inputs = coverage_inputs()
    if not args.check:
        faces = []
        css = ["/* Generated by scripts/subset-half-bridge-fonts.py; selected only by half-bridge-page. */"]
        for weight, codes in requested.items():
            source_relative = f"files/noto-sans-sc-chinese-simplified-{weight}-normal.woff2"
            source = base.PACKAGE / source_relative
            with TTFont(source, recalcTimestamp=False) as font:
                coverage = codes & set(font.getBestCmap())
                # Symbols outside this original source keep the existing stack;
                # no Chinese character in the actual page may rely on that path.
                assert not {code for code in codes - coverage if 0x3400 <= code <= 0x9FFF}
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
                output = OUTPUT / f"noto-sans-sc-half-bridge-{weight}-normal.woff2"
                font.save(output, reorderTables=True)
            base.verify_face(source, output, coverage, weight)
            face = {
                "weight": weight, "source": source_relative,
                "sourceSha256": base.digest(source.read_bytes()), "file": output.name,
                "bytes": output.stat().st_size, "sha256": base.digest(output.read_bytes()),
                "codepoints": base.codepoints(coverage), "fallbackCodepoints": base.codepoints(codes - coverage),
            }
            faces.append(face)
            css.append("@font-face {\n  font-family: '" + FAMILY + "';\n  font-style: normal;\n  font-display: swap;\n  font-weight: " + str(weight) + ";\n  src: url('/fonts/" + output.name + "') format('woff2');\n  unicode-range: " + ",".join(face["codepoints"]) + ";\n}")
            print(f"{weight}: {face['bytes']} bytes / {len(coverage)} codepoints; exact outlines verified")
        manifest = {
            "format": "noto-half-bridge-subsets-v1", "family": FAMILY,
            "package": "@fontsource/noto-sans-sc", "packageVersion": package["version"],
            "license": {"spdx": "OFL-1.1", "file": "OFL.txt", "sha256": base.digest((OUTPUT / "OFL.txt").read_bytes())},
            "tools": {"fonttools": base.FONTTOOLS_VERSION, "brotli": base.BROTLI_VERSION},
            "coverageRule": "L1 interface and all ten part records by actual CSS/UA weight, plus shared shell. Latin remains Geist; symbols/future uncovered copy retain the original global fallback.",
            "weightRules": WEIGHT_RULES, "faces": faces,
        }
        MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
        CSS.write_text("\n".join(css) + "\n", encoding="utf-8", newline="\n")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert [face["weight"] for face in manifest["faces"]] == [400, 500, 600, 700]
    for face in manifest["faces"]:
        source, output = base.PACKAGE / face["source"], OUTPUT / face["file"]
        assert base.digest(source.read_bytes()) == face["sourceSha256"]
        assert base.digest(output.read_bytes()) == face["sha256"]
        assert output.stat().st_size == face["bytes"]
        with TTFont(source, recalcTimestamp=False) as original:
            expected = requested[face["weight"]] & set(original.getBestCmap())
        assert expected == {int(code[2:], 16) for code in face["codepoints"]}, "L1 copy changed; regenerate scoped fonts"
        assert base.codepoints(requested[face["weight"]] - expected) == face["fallbackCodepoints"]
        assert not {code for code in requested[face["weight"]] - expected if 0x3400 <= code <= 0x9FFF}
        base.verify_face(source, output, expected, face["weight"])
    assert base.digest((OUTPUT / "OFL.txt").read_bytes()) == manifest["license"]["sha256"]
    verify_css(manifest["faces"])
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report(manifest, requested, inputs), indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"PASS: four L1 faces, {sum(face['bytes'] for face in manifest['faces'])} bytes; exact outlines, weights, metrics, cmap, CSS ranges and provenance")


if __name__ == "__main__":
    main()
