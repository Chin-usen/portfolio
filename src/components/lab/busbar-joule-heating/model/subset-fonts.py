"""Authoring-only S2 (busbar Joule heating) font subsets; ordinary Node builds use checked-in assets.

Run with the pinned scripts/font-subset-requirements.txt environment from the repository root:
    python src/components/lab/busbar-joule-heating/model/subset-fonts.py [--check]
Output stays in this component and public/models/busbar-joule-heating/fonts. Original Noto glyph
outlines, metrics, weights and license/name metadata are unchanged (verified per glyph).
"""
from __future__ import annotations

import argparse
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
SLUG = "busbar-joule-heating"
COMPONENT = ROOT / "src/components/lab" / SLUG
spec = importlib.util.spec_from_file_location("busbar_base_subsetter", ROOT / "scripts/subset-noto-fonts.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
input_spec = importlib.util.spec_from_file_location("lab_font_inputs", ROOT / "scripts/lab-font-inputs.py")
lab_inputs = importlib.util.module_from_spec(input_spec)
input_spec.loader.exec_module(lab_inputs)
OUTPUT = ROOT / "public/models" / SLUG / "fonts"
MANIFEST = OUTPUT / f"noto-sans-sc-{SLUG}-manifest.json"
CSS = COMPONENT / f"{SLUG}-fonts.css"
FAMILY = "Noto Sans SC Busbar"
URL = f"/models/{SLUG}/fonts/"
WEIGHTS = (400, 500, 600, 700)
# Explicit weights from thermal-stack/thermal.css (shared S1 styles), busbar.css and navigation.css.
KEYS_BY_WEIGHT = {
    500: ("lossBreakdown", "topology", "boundaryTitle", "descriptionHeading"),
    600: (
        "eyebrow",
        "tabs",
        "parameterTitle",
        "modelLabel",
        "validationLabel",
        "stateSh",
        "stateSl",
        "fieldTemperature",
        "fieldCurrent",
    ),
    700: ("title",),
}
WEIGHT_RULES = {
    400: "All S2 text: both copy locales, both content entries (incl. conductor parts), component markup/runtime strings, shared simulation shell, site shell/footer.",
    500: "Section captions (.thermal-section-caption h2) and desktop navigation (.n1-nav-list a).",
    600: "Eyebrow, selected tabs and segmented buttons, card/parameter headings, note labels, conductor names (card h2, part h3), site name and active navigation.",
    700: "H1 title and mobile navigation links.",
}


def copy_values(source: str, locale: str) -> dict[str, str]:
    block = re.search(r"  " + locale + r": \{(.*?)\n  \},", source, re.S)
    assert block, f"Review {locale} copy structure"
    values = {}
    for key in {k for keys in KEYS_BY_WEIGHT.values() for k in keys}:
        match = re.search(r"^    " + key + r": (?:'((?:\\.|[^'\\])*)'|\{(.*?)\})", block[1], re.M | re.S)
        assert match, f"Review font coverage after copy changes: {locale}.{key}"
        values[key] = match[1] if match[1] is not None else match[2]
    return values


def coverage_inputs():
    inputs: dict[str, str] = {}

    def read(relative: str) -> str:
        path = ROOT / relative
        inputs[relative] = base.digest(path.read_bytes())
        return path.read_text(encoding="utf-8-sig")

    text = lab_inputs.component_text(SLUG, inputs)
    copy_source = read(f"src/components/lab/{SLUG}/copy.ts")
    # Shared S1 simulation styles define most weights on this page.
    read("src/components/lab/thermal-stack/thermal.css")
    read("src/components/lab/thermal-stack/viewer-shared.ts")
    for name in ("SimulationShell", "SimulationCard"):
        text += read(f"src/components/lab/_shared/simulation/{name}.astro")
    nav = ""
    dictionary = read("src/i18n/dictionaries.ts")
    nav += "".join(match[1] for match in re.finditer(r"^  nav: \{(.*?)^  \},", dictionary, re.M | re.S))
    sources = {400: text, 500: nav, 600: nav, 700: nav}
    names = ""
    for locale in ("zh", "en"):
        home = json.loads(read(f"src/content/home/{locale}.json"))
        nav_text = home["name"] + home["navWork"] + home["navLab"]
        for weight in (500, 600, 700):
            sources[weight] += nav_text
        values = copy_values(copy_source, locale)
        for weight, keys in KEYS_BY_WEIGHT.items():
            sources[weight] += "".join(values[key] for key in keys)
        document = read(f"src/content/lab/{locale}/{SLUG}.md")
        names += "".join(re.findall(r"^    name: '([^']*)'", document, re.M))
        title = re.search(r"^title: '([^']*)'", document, re.M)
        assert title, "Content title"
        sources[700] += title[1]
    assert names, "Conductor part names"
    sources[600] += names
    requested = {}
    for weight, source in sources.items():
        codes = {ord(character) for character in source if ord(character) > 127}
        codes |= {mirror for code in tuple(codes) if (mirror := mirrored(code)) is not None}
        requested[weight] = codes
    # Every heavier face must be a subset of the full 400 text, so no string escapes coverage.
    for weight in (500, 600, 700):
        assert requested[weight] <= requested[400] | {ord(c) for c in nav}, f"{weight} text outside page text"
    bindings = [{"path": path, "sha256": checksum} for path, checksum in sorted(inputs.items())]
    return requested, bindings


def css_unicode_range(codepoints):
    value = ", ".join(codepoints) + ";"
    line = "  unicode-range: " + value
    if len(line) <= 100:
        return line
    return "  unicode-range:\n" + textwrap.fill(value, width=100, initial_indent="    ", subsequent_indent="    ", break_long_words=False, break_on_hyphens=False)


def verify_css(faces):
    css = CSS.read_text(encoding="utf-8")
    blocks = re.findall(r"@font-face\s*\{(.*?)\}", css, re.S)
    assert len(blocks) == len(WEIGHTS)
    for face, block in zip(faces, blocks, strict=True):
        assert f"font-family: '{FAMILY}'" in block
        assert f"font-weight: {face['weight']}" in block
        assert "font-display: optional" in block
        assert URL + face["file"] in block
        ranges = re.search(r"unicode-range:\s*([^;]+)", block)[1]
        assert set(re.findall(r"U\+[0-9A-F]+", ranges)) == set(face["codepoints"])
    assert "body.busbar-page" in css


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    assert base.fontTools.__version__ == base.FONTTOOLS_VERSION == "4.65.0"
    assert base.brotli.__version__ == base.BROTLI_VERSION == "1.2.0"
    package = json.loads((base.PACKAGE / "package.json").read_text(encoding="utf-8"))
    assert package["version"] == "5.3.1"
    requested, bindings = coverage_inputs()
    license_bytes = (base.PACKAGE / "LICENSE").read_bytes()
    if not args.check:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        (OUTPUT / "OFL.txt").write_bytes(license_bytes)
        faces = []
        css = [f"/* Generated by {SLUG}/model/subset-fonts.py; S2 page only. */"]
        for weight in WEIGHTS:
            codes = requested[weight]
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
                output = OUTPUT / f"noto-sans-sc-{SLUG}-{weight}-normal.woff2"
                font.save(output, reorderTables=True)
            base.verify_face(source, output, coverage, weight)
            face = {"weight": weight, "source": source_relative, "sourceSha256": base.digest(source.read_bytes()),
                    "file": output.name, "bytes": output.stat().st_size, "sha256": base.digest(output.read_bytes()),
                    "codepoints": base.codepoints(coverage), "fallbackCodepoints": base.codepoints(codes - coverage)}
            faces.append(face)
            css.append("@font-face {\n  font-family: '" + FAMILY + "';\n  font-style: normal;\n  font-display: optional;\n  font-weight: " + str(weight) + ";\n  src: url('" + URL + output.name + "') format('woff2');\n" + css_unicode_range(face["codepoints"]) + "\n}")
            print(f"{weight}: {face['bytes']} bytes / {len(coverage)} original codepoints", flush=True)
        css.append("body.busbar-page {\n  --thermal-font:\n    'Geist Variable', 'Noto Sans SC Busbar', -apple-system, BlinkMacSystemFont, sans-serif;\n  font-family: var(--thermal-font);\n}")
        manifest = {"format": "noto-busbar-joule-heating-subsets-v1", "family": FAMILY,
                    "package": "@fontsource/noto-sans-sc", "packageVersion": package["version"],
                    "license": {"spdx": "OFL-1.1", "file": "OFL.txt", "source": "node_modules/@fontsource/noto-sans-sc/LICENSE", "sha256": base.digest(license_bytes)},
                    "tools": {"fonttools": base.FONTTOOLS_VERSION, "brotli": base.BROTLI_VERSION},
                    "coverageRule": "All S2 text at 400; CSS-mapped captions, labels, headings and navigation at 500/600/700. Latin remains Geist; symbols outside the original master use the system stack.",
                    "sourceBindings": bindings, "weightKeys": KEYS_BY_WEIGHT, "weightRules": WEIGHT_RULES, "faces": faces}
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
        CSS.write_text("\n".join(css) + "\n", encoding="utf-8", newline="\n")
        subprocess.run(["node", str(ROOT / "node_modules/prettier/bin/prettier.cjs"), "--write", str(MANIFEST), str(CSS)], cwd=ROOT, check=True)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert manifest["sourceBindings"] == bindings, "Source bindings changed; regenerate S2 fonts"
    assert [face["weight"] for face in manifest["faces"]] == list(WEIGHTS)
    assert (OUTPUT / "OFL.txt").read_bytes() == license_bytes
    for face in manifest["faces"]:
        source, output = base.PACKAGE / face["source"], OUTPUT / face["file"]
        assert base.digest(source.read_bytes()) == face["sourceSha256"]
        assert base.digest(output.read_bytes()) == face["sha256"]
        with TTFont(source, recalcTimestamp=False) as original:
            expected = requested[face["weight"]] & set(original.getBestCmap())
        assert expected == {int(code[2:], 16) for code in face["codepoints"]}, "S2 copy changed; regenerate fonts"
        base.verify_face(source, output, expected, face["weight"])
    verify_css(manifest["faces"])
    total = sum(face["bytes"] for face in manifest["faces"])
    print(f"PASS: four S2 faces, {total} bytes; exact outlines, metrics, weights, coverage and license", flush=True)


if __name__ == "__main__":
    main()
