"""Authoring-only pin-fin cooler font subsets; ordinary Node builds use checked-in assets.

Run with the pinned scripts/font-subset-requirements.txt environment. Output is scoped to
this component and public/models/pin-fin-cooler/fonts. Every one of the four original Noto
weights covers the complete page text (both locales, part collection, runtime copy, shared
shell), so no CSS-to-copy weight map is needed. Original outlines, metrics and
licence/name metadata remain unchanged.
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
SLUG = "pin-fin-cooler"
COMPONENT = ROOT / "src/components/lab" / SLUG
spec = importlib.util.spec_from_file_location("pin_fin_base_subsetter", ROOT / "scripts/subset-noto-fonts.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
input_spec = importlib.util.spec_from_file_location("lab_font_inputs", ROOT / "scripts/lab-font-inputs.py")
lab_inputs = importlib.util.module_from_spec(input_spec)
input_spec.loader.exec_module(lab_inputs)
OUTPUT = ROOT / "public/models" / SLUG / "fonts"
MANIFEST = OUTPUT / f"noto-sans-sc-{SLUG}-manifest.json"
CSS = COMPONENT / f"{SLUG}-fonts.css"
FAMILY = "Noto Sans SC Pin Fin"
URL = f"/models/{SLUG}/fonts/"
WEIGHTS = (400, 500, 600, 700)


def encode_hashes(value, key=""):
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
        return "".join(value)
    if isinstance(value, dict):
        return {name: decode_hashes(item, name) for name, item in value.items()}
    if isinstance(value, list):
        return [decode_hashes(item) for item in value]
    return value


def coverage_inputs():
    inputs = {}
    script = (ROOT / "src/components/lab" / SLUG / "model/subset-fonts.py")
    inputs[script.relative_to(ROOT).as_posix()] = base.digest(script.read_bytes())
    text = lab_inputs.component_text(SLUG, inputs)
    # The page also inlines the S1 surface stylesheet; bind it so weight-relevant edits rebind.
    lab_inputs.read("src/components/lab/thermal-stack/thermal.css", inputs)
    codes = {ord(character) for character in text if ord(character) > 127}
    codes |= {mirror for code in tuple(codes) if (mirror := mirrored(code)) is not None}
    bindings = [{"path": path, "sha256": checksum} for path, checksum in sorted(inputs.items())]
    return {weight: set(codes) for weight in WEIGHTS}, bindings


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
    assert f"'{FAMILY}'" in re.search(r"body\.thermal-page\.pin-fin-cooler-page\s*\{(.*?)\}", css, re.S)[1]
    page = json.loads((COMPONENT / "page.json").read_text(encoding="utf-8"))
    assert page["fonts"]["commonNoto"] is False
    assert page["fonts"]["preload"] == {"zh": [], "en": []}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    assert base.fontTools.__version__ == base.FONTTOOLS_VERSION == "4.65.0"
    assert base.brotli.__version__ == base.BROTLI_VERSION == "1.2.0"
    package = json.loads((base.PACKAGE / "package.json").read_text(encoding="utf-8"))
    assert package["version"] == "5.3.1"
    requested, inputs = coverage_inputs()
    license_bytes = (base.PACKAGE / "LICENSE").read_bytes()
    if not args.check:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        (OUTPUT / "OFL.txt").write_bytes(license_bytes)
        faces = []
        css = [f"/* Generated by {SLUG}/model/subset-fonts.py; pin-fin cooler pages only. */"]
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
        css.append("body.thermal-page.pin-fin-cooler-page {\n  --thermal-font:\n    'Geist Variable', '" + FAMILY + "', -apple-system, BlinkMacSystemFont, sans-serif;\n  font-family: var(--thermal-font);\n}")
        manifest = {"format": "noto-pin-fin-cooler-subsets-v1", "family": FAMILY,
                    "hashEncoding": "Every SHA-256 is eight ordered hexadecimal groups; concatenate without separators for its canonical value.",
                    "package": "@fontsource/noto-sans-sc", "packageVersion": package["version"],
                    "license": {"spdx": "OFL-1.1", "file": "OFL.txt", "source": "node_modules/@fontsource/noto-sans-sc/LICENSE", "sha256": base.digest(license_bytes)},
                    "tools": {"fonttools": base.FONTTOOLS_VERSION, "brotli": base.BROTLI_VERSION},
                    "coverageRule": "Every weight covers all pin-fin page text in both locales, the five-part collection, runtime copy and the shared shell. Latin remains Geist; symbols outside the original master use existing fallbacks.",
                    "sourceBindings": inputs, "faces": faces}
        MANIFEST.write_text(json.dumps(encode_hashes(manifest), indent=2) + "\n", encoding="utf-8", newline="\n")
        CSS.write_text("\n".join(css) + "\n", encoding="utf-8", newline="\n")
        subprocess.run(["node", str(ROOT / "node_modules/prettier/bin/prettier.cjs"), "--write", str(MANIFEST), str(CSS)], cwd=ROOT, check=True)
    manifest = decode_hashes(json.loads(MANIFEST.read_text(encoding="utf-8")))
    assert manifest["sourceBindings"] == inputs, "Source bindings changed; regenerate fonts"
    assert [face["weight"] for face in manifest["faces"]] == list(WEIGHTS)
    assert (OUTPUT / "OFL.txt").read_bytes() == license_bytes
    for face in manifest["faces"]:
        source, output = base.PACKAGE / face["source"], OUTPUT / face["file"]
        assert base.digest(source.read_bytes()) == face["sourceSha256"]
        assert base.digest(output.read_bytes()) == face["sha256"]
        with TTFont(source, recalcTimestamp=False) as original:
            expected = requested[face["weight"]] & set(original.getBestCmap())
        assert expected == {int(code[2:], 16) for code in face["codepoints"]}, "Copy changed; regenerate fonts"
        base.verify_face(source, output, expected, face["weight"])
    verify_css(manifest["faces"])
    total = sum(face["bytes"] for face in manifest["faces"])
    print(f"PASS: four pin-fin faces, {total} bytes; exact outlines, metrics, weights, coverage, metadata and license", flush=True)


if __name__ == "__main__":
    main()
