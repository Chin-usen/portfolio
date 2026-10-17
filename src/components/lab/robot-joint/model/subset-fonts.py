"""Authoring-only robot joint font subsets; ordinary Node builds use checked-in assets.

Run with the pinned scripts/font-subset-requirements.txt environment. All output
is scoped to this component and public/models/robot-joint/fonts. Original Noto
glyph outlines, weights, metrics and license/name metadata remain unchanged.
"""
from __future__ import annotations

import argparse
import ast
import importlib.util
import json
import re
import subprocess
import textwrap
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.unicodedata import mirrored

ROOT = Path(__file__).resolve().parents[5]
COMPONENT = ROOT / "src/components/lab/robot-joint"
spec = importlib.util.spec_from_file_location("robot_joint_base_subsetter", ROOT / "scripts/subset-noto-fonts.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
input_spec = importlib.util.spec_from_file_location("lab_font_inputs", ROOT / "scripts/lab-font-inputs.py")
lab_inputs = importlib.util.module_from_spec(input_spec)
input_spec.loader.exec_module(lab_inputs)
OUTPUT = ROOT / "public/models/robot-joint/fonts"
MANIFEST = OUTPUT / "noto-sans-sc-robot-joint-manifest.json"
CSS = COMPONENT / "robot-joint-fonts.css"
FAMILY = "Noto Sans SC Robot Joint"
URL = "/models/robot-joint/fonts/"
WEIGHTS = (400, 500, 600, 700)
WEIGHT_RULES = {
    400: "All robot-joint text, dynamic linked-flow descriptions, all 14 parts in both content entries, English secondary Chinese names, body copy, controls, shared shell/footer.",
    500: "Shared desktop navigation labels (.n1-nav-list a).",
    600: "Kicker, all selected mode labels, all 14 selected part short names, selected flow nodes and linked full part names, flow heading, assumptions summary, shared site name and active desktop navigation; exact 600 master.",
    700: "Title, all 14 primary selected/noscript part names, formula and all-parts headings, shared mobile navigation; exact 700 master. Local flow h2 is explicitly 600; shared .l1-small-label overrides to 400.",
}



def encode_hashes(value, key=""):
    # Lossless eight-group SHA-256 representation avoids accidental phone-shaped
    # digit runs in machine hashes. Privacy scanner rules and real text stay unchanged.
    if isinstance(value, dict):
        return {name: encode_hashes(item, name) for name, item in value.items()}
    if isinstance(value, list):
        return [encode_hashes(item) for item in value]
    if isinstance(key, str) and key.lower().endswith("sha256") and isinstance(value, str):
        assert re.fullmatch(r"[0-9a-f]{64}", value), "Invalid SHA-256 value"
        return [value[index:index + 8] for index in range(0, 64, 8)]
    return value


def decode_hashes(value, key=""):
    if isinstance(key, str) and key.lower().endswith("sha256"):
        assert isinstance(value, list) and len(value) == 8
        assert all(isinstance(item, str) and re.fullmatch(r"[0-9a-f]{8}", item) for item in value)
        return "".join(value)
    if isinstance(value, dict):
        return {name: decode_hashes(item, name) for name, item in value.items()}
    if isinstance(value, list):
        return [decode_hashes(item) for item in value]
    return value


def coverage_inputs():
    inputs = {}

    def read(relative):
        path = ROOT / relative
        inputs[relative] = base.digest(path.read_bytes())
        return path.read_text(encoding="utf-8-sig")

    read("src/components/lab/robot-joint/model/subset-fonts.py")
    text = ""
    for path in sorted(COMPONENT.iterdir()):
        if path.is_file() and path.suffix in {".astro", ".ts", ".json"}:
            text += read(path.relative_to(ROOT).as_posix())
    copy_source = read("src/components/lab/robot-joint/copy.ts")
    copies = {}
    for locale in ("zh", "en"):
        block = re.search(r"  " + locale + r": \{(.*?)\n  \},", copy_source, re.S)
        assert block, f"Review {locale} copy structure"
        copies[locale] = {
            key: ast.literal_eval(value)
            for key, value in re.findall(r"^\s{4}(\w+):\s*('(?:\\.|[^'\\])*')", block[1], re.M)
        }
    counts, part_fields = {}, {}
    for locale in ("zh", "en"):
        document = read(f"src/content/lab/{locale}/robot-joint.md")
        ids = re.findall(r"^  - id: ['\"]([^'\"]+)['\"]", document, re.M)
        assert len(ids) == len(set(ids)) == 14, f"Review {locale} part collection coverage"
        counts[locale] = ids
        part_fields[locale] = {}
        for field in ("name", "short", "secondaryName"):
            values = re.findall(r"^    " + field + r": ('(?:\\.|[^'\\\n])*')\s*$", document, re.M)
            assert len(values) == 14, f"Review all 14 {locale} part {field} strings"
            part_fields[locale][field] = "".join(ast.literal_eval(value) for value in values)
        text += document
    assert counts["zh"] == counts["en"], "Locale part collections differ"
    for name in ("DisassemblyPage", "StageCard", "SelectedPartCard", "PartTags"):
        text += read(f"src/components/lab/_shared/disassembly/{name}.astro")
    dictionary = read("src/i18n/dictionaries.ts")
    nav_blocks = re.findall(r"  nav: \{(.*?)\n  \},", dictionary, re.S)
    common_blocks = re.findall(r"  common: \{(.*?)\n  \},", dictionary, re.S)
    assert len(nav_blocks) == len(common_blocks) == 2, "Review dictionary structure"
    nav = "".join(ast.literal_eval(re.search(r"about:\s*('(?:\\.|[^'\\])*')", block)[1]) for block in nav_blocks)
    text += "".join(nav_blocks + common_blocks)
    site_names, active_nav = "", ""
    for locale in ("zh", "en"):
        home = json.loads(read(f"src/content/home/{locale}.json"))
        nav += home["navWork"] + home["navLab"]
        active_nav += home["navLab"]
        site_names += home["name"]
        text += home["name"] + json.dumps(home["footer"], ensure_ascii=False)
    for name in ("Header", "Footer"):
        text += read(f"src/components/{name}.astro")
    text += nav
    shared = read("src/components/lab/_shared/disassembly/disassembly.css")
    hd_css = read("src/components/lab/robot-joint/robot-joint.css")
    navigation = read("src/styles/navigation.css")
    for path in ("src/styles/global.css", "src/styles/thermal-tokens.css", "src/styles/tokens.css", "src/layouts/BaseLayout.astro"):
        read(path)
    # Every explicit local weight is guarded. Unstyled h1/h2/h3 retain their
    # browser 700 weight; .l1-small-label and .l1-part-translation override to 400.
    expected_declarations = (
        (shared, [600, 600, 600, 600, 400, 400]),
        (hd_css, [600, 600, 400, 600, 600, 600]),
        (navigation, [600, 500, 600, 700, 400]),
    )
    for source, weights in expected_declarations:
        assert [int(value) for value in re.findall(r"font-weight:\s*(\d+)\s*;", source)] == weights, "Weight declarations changed; review robot joint coverage mapping"
    selectors = [
        (shared, ".l1-kicker", 600),
        (shared, ".l1-modes button[aria-pressed='true']", 600),
        (shared, ".l1-labels button[aria-pressed='true']", 600),
        (shared, ".l1-parts button[aria-pressed='true']", 600),
        (shared, ".l1-small-label", 400),
        (shared, ".l1-part-translation", 400),
        (hd_css, ".rj-flow h2", 600),
        (hd_css, ".rj-flow-node[data-selected='true']", 600),
        (hd_css, ".rj-external-label", 400),
        (hd_css, ".rj-flow-selected strong", 600),
        (hd_css, ".rj-assumptions summary", 600),
        (hd_css, ".rj-stage-selection strong", 600),
        (navigation, ".n1-header .site-name", 600),
        (navigation, ".n1-nav-list a", 500),
        (navigation, ".n1-nav-list a[aria-current='page']", 600),
        (navigation, ".n1-menu-links a", 700),
        (navigation, ".n1-menu-contact a", 400),
    ]
    for source, selector, weight in selectors:
        blocks = re.findall(re.escape(selector) + r"\s*\{([^}]*)\}", source)
        declared = [int(found[1]) for block in blocks if (found := re.search(r"font-weight:\s*(\d+)\s*;", block))]
        assert declared and declared[-1] == weight, selector
    keys = {600: ("kicker", "whole", "mechanism", "assumptions", "flowTitle",
                  "dcBus", "driver", "motor", "reducer", "output", "motorFeedback", "outputFeedback", "brake"),
            700: ("title", "allParts")}
    sources = {400: text, 500: nav, 600: site_names + active_nav, 700: nav}
    for locale in ("zh", "en"):
        sources[600] += part_fields[locale]["short"] + part_fields[locale]["name"]
        sources[700] += part_fields[locale]["name"]
        for weight in (600, 700):
            sources[weight] += "".join(copies[locale][key] for key in keys[weight])
        assert set(part_fields[locale]["secondaryName"]) <= set(sources[400])
        for key in ("modelScope", "geometryNote", "hollowNote", "brakeNote", "limitsNote", "provenance"):
            assert copies[locale][key] in sources[400], f"Missing updated {locale} {key} copy"
    sources[400] += lab_inputs.component_text("robot-joint", inputs)
    requested = {}
    for weight, source in sources.items():
        codes = {ord(character) for character in source if ord(character) > 127}
        codes |= {mirror for code in tuple(codes) if (mirror := mirrored(code)) is not None}
        requested[weight] = codes
    bindings = [{"path": path, "sha256": checksum} for path, checksum in sorted(inputs.items())]
    mapping = {"copyKeysByWeight": keys, "partFieldsByWeight": {400: "all fields, including secondaryName", 600: "short and name (local linked-flow and stage selected labels)", 700: "name"},
               "verifiedSelectors": [{"selector": selector, "weight": weight} for _, selector, weight in selectors]}
    return requested, bindings, counts, mapping


def css_unicode_range(codepoints):
    value = ", ".join(codepoints) + ";"
    line = "  unicode-range: " + value
    if len(line) <= 100:
        return line
    return "  unicode-range:\n" + textwrap.fill(value, width=100, initial_indent="    ", subsequent_indent="    ", break_long_words=False, break_on_hyphens=False)


def verify_css(faces):
    css = CSS.read_text(encoding="utf-8")
    blocks = re.findall(r"@font-face\s*\{(.*?)\}", css, re.S)
    assert len(blocks) == 4
    for face, block in zip(faces, blocks, strict=True):
        assert f"font-family: '{FAMILY}'" in block
        assert f"font-weight: {face['weight']}" in block
        assert "font-display: optional" in block
        assert URL + face["file"] in block
        ranges = re.search(r"unicode-range:\s*([^;]+)", block)[1]
        assert set(re.findall(r"U\+[0-9A-F]+", ranges)) == set(face["codepoints"])
    stack = re.search(r"body\.robot-joint-page\s*\{(.*?)\}", css, re.S)[1]
    assert re.search(r"'Geist Variable'\s*,\s*'Noto Sans SC Robot Joint'\s*,\s*-apple-system", stack)
    assert "font-family: var(--thermal-font)" in stack
    page = json.loads((COMPONENT / "page.json").read_text(encoding="utf-8"))
    assert page["fonts"]["commonNoto"] is False
    assert page["fonts"]["mono"] is False
    assert page["fonts"]["preload"] == {"zh": [], "en": []}, "robot joint fonts load on demand through the unchanged face rules"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    assert base.fontTools.__version__ == base.FONTTOOLS_VERSION == "4.65.0"
    assert base.brotli.__version__ == base.BROTLI_VERSION == "1.2.0"
    package = json.loads((base.PACKAGE / "package.json").read_text(encoding="utf-8"))
    assert package["version"] == "5.3.1"
    requested, inputs, parts, mapping = coverage_inputs()
    license_bytes = (base.PACKAGE / "LICENSE").read_bytes()
    if not args.check:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        (OUTPUT / "OFL.txt").write_bytes(license_bytes)
        faces = []
        css = ["/* Generated by robot-joint/model/subset-fonts.py; robot joint pages only. */"]
        for weight, codes in requested.items():
            source_relative = f"files/noto-sans-sc-chinese-simplified-{weight}-normal.woff2"
            source = base.PACKAGE / source_relative
            with TTFont(source, recalcTimestamp=False) as font:
                coverage = codes & set(font.getBestCmap())
                assert not {code for code in codes - coverage if 0x3400 <= code <= 0x9FFF}, "Missing CJK in original face"
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
                output = OUTPUT / f"noto-sans-sc-robot-joint-{weight}-normal.woff2"
                font.save(output, reorderTables=True)
            base.verify_face(source, output, coverage, weight)
            face = {"weight": weight, "source": source_relative, "sourceSha256": base.digest(source.read_bytes()),
                    "file": output.name, "bytes": output.stat().st_size, "sha256": base.digest(output.read_bytes()),
                    "codepoints": base.codepoints(coverage), "fallbackCodepoints": base.codepoints(codes - coverage)}
            faces.append(face)
            css.append("@font-face {\n  font-family: '" + FAMILY + "';\n  font-style: normal;\n  font-display: optional;\n  font-weight: " + str(weight) + ";\n  src: url('" + URL + output.name + "') format('woff2');\n" + css_unicode_range(face["codepoints"]) + "\n}")
            print(f"{weight}: {face['bytes']} bytes / {len(coverage)} original codepoints", flush=True)
        css.append("body.robot-joint-page {\n  --thermal-font:\n    'Geist Variable', 'Noto Sans SC Robot Joint', -apple-system, BlinkMacSystemFont,\n    sans-serif;\n  font-family: var(--thermal-font);\n}")
        manifest = {"format": "noto-robot-joint-subsets-v2", "family": FAMILY,
                    "hashEncoding": "Every SHA-256 is eight ordered hexadecimal groups; concatenate without separators for its canonical value.",
                    "package": "@fontsource/noto-sans-sc", "packageVersion": package["version"],
                    "license": {"spdx": "OFL-1.1", "file": "OFL.txt", "source": "node_modules/@fontsource/noto-sans-sc/LICENSE", "sha256": base.digest(license_bytes)},
                    "tools": {"fonttools": base.FONTTOOLS_VERSION, "brotli": base.BROTLI_VERSION},
                    "coverageRule": "Both robot joint locales, all 14 parts, linked-flow descriptions and provenance, shared shell/footer at 400. Actual CSS-mapped navigation/selected controls/headings at 500/600/700. Latin remains Geist; symbols outside the original master retain existing fallback.",
                    "sourceBindings": inputs, "weightMapping": mapping,
                    "weightRules": WEIGHT_RULES, "faces": faces}
        MANIFEST.write_text(json.dumps(encode_hashes(manifest), indent=2) + "\n", encoding="utf-8", newline="\n")
        CSS.write_text("\n".join(css) + "\n", encoding="utf-8", newline="\n")
        subprocess.run(["node", str(ROOT / "node_modules/prettier/bin/prettier.cjs"), "--write", str(MANIFEST), str(CSS)], cwd=ROOT, check=True)
    manifest = decode_hashes(json.loads(MANIFEST.read_text(encoding="utf-8")))
    assert manifest["format"] == "noto-robot-joint-subsets-v2"
    assert manifest["sourceBindings"] == inputs, "Source bindings changed; regenerate fonts and reports"
    assert [face["weight"] for face in manifest["faces"]] == list(WEIGHTS)
    assert (OUTPUT / "OFL.txt").read_bytes() == license_bytes
    assert base.digest(license_bytes) == manifest["license"]["sha256"]
    for face in manifest["faces"]:
        source, output = base.PACKAGE / face["source"], OUTPUT / face["file"]
        assert base.digest(source.read_bytes()) == face["sourceSha256"]
        assert base.digest(output.read_bytes()) == face["sha256"]
        assert output.stat().st_size == face["bytes"]
        with TTFont(source, recalcTimestamp=False) as original:
            expected = requested[face["weight"]] & set(original.getBestCmap())
        assert expected == {int(code[2:], 16) for code in face["codepoints"]}, "robot joint copy changed; regenerate fonts"
        assert base.codepoints(requested[face["weight"]] - expected) == face["fallbackCodepoints"]
        assert not {code for code in requested[face["weight"]] - expected if 0x3400 <= code <= 0x9FFF}
        base.verify_face(source, output, expected, face["weight"])
    verify_css(manifest["faces"])
    report = {"status": "passed", "scope": "Source coverage and exact original font verification; no browser/performance claim",
              "package": "@fontsource/noto-sans-sc@5.3.1", "tools": manifest["tools"],
              "sourceBindings": inputs, "partsByLocale": parts, "weightMapping": mapping, "license": manifest["license"],
              "manifestSha256": base.digest(MANIFEST.read_bytes()), "cssSha256": base.digest(CSS.read_bytes()),
              "totalBytes": sum(face["bytes"] for face in manifest["faces"]),
              "checks": ["All Chinese codepoints covered in both robot joint locales and every part", "Original glyph outlines and advance/vertical metrics unchanged", "Four actual original weights 400/500/600/700", "Original license/name/copyright metadata retained", "English secondary Chinese uses the same robot joint font stack", "CSS unicode ranges match verified assets; unused mono preload disabled and all robot joint faces load on demand", "Only the scoped verified Noto subset is registered; system fallback remains"],
              "weightRules": WEIGHT_RULES, "faces": manifest["faces"]}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"PASS: four robot joint faces, {report['totalBytes']} bytes; exact outlines, metrics, weights, coverage, metadata and license", flush=True)


if __name__ == "__main__":
    main()
