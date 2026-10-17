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
# (face id, weight). The regular weight is split by unicode-range: "400" covers first-screen text,
# "400-deferred" the copy that appears only in the details, validity and notes cards, which use
# content-visibility: auto and sit more than two viewports down,
# so the browser fetches it only when those cards are laid out. Both are the original 400 master.
FACES = (("400", 400), ("400-deferred", 400), ("500", 500), ("600", 600), ("700", 700))
DEFERRED_COPY_KEYS = (
    "detailsTitle", "details", "pumpingLabel", "tBaseLabel", "validityTitle", "validityIntro",
    "validityColumns", "correlations", "statusNames", "validity", "methodTitle", "method",
    "formulasTitle", "assumptionsTitle", "assumptions", "propertiesNote", "referencesTitle",
    "references",
)


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


WEIGHT_RULES = {
    400: "All page text in both locales: Content Collection entries, component and runtime copy, shared simulation shell, header/footer.",
    500: "Shared desktop navigation labels (.n1-nav-list a).",
    600: "Eyebrow, card/section headings, parameter tabs, validity group headings, 'outside' status pill, streamline badge, note labels, selected part names, site name and active navigation.",
    700: "Page title (h1) and shared mobile-menu / [aria-current] navigation labels.",
}
# CSS declarations reviewed against the copy below. Any change to these weight lists fails the
# generator until the CSS-to-copy map is reviewed again.
EXPECTED_DECLARATIONS = {
    "src/components/lab/thermal-stack/thermal.css": [600, 700, 600, 500, 600, 600, 500, 600, 600, 600, 600, 600, 600],
    "src/components/lab/pin-fin-cooler/pin-fin.css": [600, 600, 400, 600, 600, 600, 400, 600, 400, 600],
    "src/styles/navigation.css": [600, 500, 600, 700, 400],
}
# Selectors whose Chinese text is rendered above 400 on this page, with the copy that feeds them.
VERIFIED_SELECTORS = [
    ("src/components/lab/thermal-stack/thermal.css", ".thermal-eyebrow", 600),
    ("src/components/lab/thermal-stack/thermal.css", ".thermal-heading h1", 700),
    ("src/components/lab/thermal-stack/thermal.css", ".thermal-parameter-heading h2", 600),
    ("src/components/lab/thermal-stack/thermal.css", ".thermal-tabs > button[aria-selected='true']", 600),
    ("src/components/lab/thermal-stack/thermal.css", ".thermal-note-label", 600),
    ("src/components/lab/pin-fin-cooler/pin-fin.css", ".pf-part-card h2", 600),
    ("src/components/lab/pin-fin-cooler/pin-fin.css", ".pf-part-card h2 small", 400),
    ("src/components/lab/pin-fin-cooler/pin-fin.css", ".pf-card-title", 600),
    ("src/components/lab/pin-fin-cooler/pin-fin.css", ".pf-badge", 600),
    ("src/components/lab/pin-fin-cooler/pin-fin.css", ".pf-validity-group h3", 600),
    ("src/components/lab/pin-fin-cooler/pin-fin.css", ".pf-validity th", 400),
    ("src/components/lab/pin-fin-cooler/pin-fin.css", ".pf-table-details :is(th, td)", 400),
    ("src/components/lab/pin-fin-cooler/pin-fin.css", ".pf-validity tr[data-status='out'] .pf-pill", 600),
    ("src/styles/navigation.css", ".n1-header .site-name", 600),
    ("src/styles/navigation.css", ".n1-nav-list a", 500),
    ("src/styles/navigation.css", ".n1-nav-list a[aria-current='page']", 600),
    ("src/styles/navigation.css", ".n1-menu-contact a", 400),
]
COPY_KEYS = {
    600: ("eyebrow", "parameterTitle", "streamTitle", "sweepTitle", "detailsTitle", "validityTitle",
          "streamBadge", "methodTitle", "formulasTitle", "assumptionsTitle", "referencesTitle"),
    700: ("title",),
}
COPY_DICTS_600 = ("tabs", "correlations")


def coverage_inputs():
    inputs = {}
    script = (ROOT / "src/components/lab" / SLUG / "model/subset-fonts.py")
    inputs[script.relative_to(ROOT).as_posix()] = base.digest(script.read_bytes())
    text = lab_inputs.component_text(SLUG, inputs)
    sources_css = {}
    for relative in EXPECTED_DECLARATIONS:
        sources_css[relative] = lab_inputs.read(relative, inputs)
    for relative, expected in EXPECTED_DECLARATIONS.items():
        found = [int(value) for value in re.findall(r"font-weight:\s*(\d+)\s*;", sources_css[relative])]
        assert found == expected, f"Weight declarations changed in {relative}: {found}; review the pin-fin weight map"
    for relative, selector, weight in VERIFIED_SELECTORS:
        blocks = re.findall(re.escape(selector) + r"\s*\{([^}]*)\}", sources_css[relative])
        declared = [int(found[1]) for block in blocks if (found := re.search(r"font-weight:\s*(\d+)\s*;", block))]
        assert declared and declared[-1] == weight, selector
    copy = json.loads(subprocess.run(
        ["node", "--experimental-strip-types", "-e",
         "import('./src/components/lab/pin-fin-cooler/copy.ts').then((m) => process.stdout.write(JSON.stringify(m.pinFinCopy)))"],
        cwd=ROOT, check=True, capture_output=True, text=True).stdout)
    dictionary = lab_inputs.read("src/i18n/dictionaries.ts", inputs)
    nav = "".join(re.findall(r"about:\s*'([^']*)'", dictionary)[:2])
    site, active = "", ""
    for locale in ("zh", "en"):
        home = json.loads(lab_inputs.read(f"src/content/home/{locale}.json", inputs))
        nav += home["navWork"] + home["navLab"]
        active += home["navLab"]
        site += home["name"]
    part_names = ""
    for locale in ("zh", "en"):
        document = lab_inputs.read(f"src/content/lab/{locale}/{SLUG}.md", inputs)
        names = re.findall(r"^    name: '([^']*)'\s*$", document, re.M)
        assert len(names) == 5, f"Review {locale} part names"
        part_names += "".join(names)
    sources = {400: text, 500: nav, 600: site + active + part_names, 700: nav}
    for locale in ("zh", "en"):
        for weight, keys in COPY_KEYS.items():
            sources[weight] += "".join(copy[locale][key] for key in keys)
        for key in COPY_DICTS_600:
            sources[600] += "".join(copy[locale][key].values())
        sources[600] += copy[locale]["statusNames"]["out"]
    def flatten(value):
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            return "".join(flatten(item) for item in value.values())
        return "".join(flatten(item) for item in value)

    copy_source = (ROOT / "src/components/lab/pin-fin-cooler/copy.ts").read_text(encoding="utf-8")
    assert copy_source in text, "copy.ts must be part of the bound page text"
    core = text.replace(copy_source, "")
    for locale in ("zh", "en"):
        assert set(DEFERRED_COPY_KEYS) <= set(copy[locale]), "Review deferred copy keys"
        core += "".join(flatten(value) for key, value in copy[locale].items() if key not in DEFERRED_COPY_KEYS)
    for weight in (500, 600, 700):
        assert {c for c in sources[weight] if ord(c) > 127} <= set(text), "Emphasis copy must also be bound page text"
    def codes_of(source):
        codes = {ord(character) for character in source if ord(character) > 127}
        return codes | {mirror for code in tuple(codes) if (mirror := mirrored(code)) is not None}

    requested = {str(weight): codes_of(source) for weight, source in sources.items()}
    complete = requested["400"]
    requested["400"] = codes_of(core) & complete
    requested["400-deferred"] = complete - requested["400"]
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
    assert len(blocks) == len(FACES)
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
    # zh preloads the first-screen 400 face and the 600 heading face; en renders no Chinese above the fold.
    assert page["fonts"]["preload"] == {"zh": [URL + f"noto-sans-sc-{SLUG}-{face}-normal.woff2" for face in ("400", "600")], "en": []}


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
        for face_id, weight in FACES:
            codes = requested[face_id]
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
                output = OUTPUT / f"noto-sans-sc-{SLUG}-{face_id}-normal.woff2"
                font.save(output, reorderTables=True)
            base.verify_face(source, output, coverage, weight)
            face = {"id": face_id, "weight": weight, "source": source_relative, "sourceSha256": base.digest(source.read_bytes()),
                    "file": output.name, "bytes": output.stat().st_size, "sha256": base.digest(output.read_bytes()),
                    "codepoints": base.codepoints(coverage), "fallbackCodepoints": base.codepoints(codes - coverage)}
            faces.append(face)
            css.append("@font-face {\n  font-family: '" + FAMILY + "';\n  font-style: normal;\n  font-display: optional;\n  font-weight: " + str(weight) + ";\n  src: url('" + URL + output.name + "') format('woff2');\n" + css_unicode_range(face["codepoints"]) + "\n}")
            print(f"{face_id}: {face['bytes']} bytes / {len(coverage)} original codepoints", flush=True)
        css.append("body.thermal-page.pin-fin-cooler-page {\n  --thermal-font:\n    'Geist Variable', '" + FAMILY + "', -apple-system, BlinkMacSystemFont, sans-serif;\n  font-family: var(--thermal-font);\n}")
        manifest = {"format": "noto-pin-fin-cooler-subsets-v1", "family": FAMILY,
                    "hashEncoding": "Every SHA-256 is eight ordered hexadecimal groups; concatenate without separators for its canonical value.",
                    "package": "@fontsource/noto-sans-sc", "packageVersion": package["version"],
                    "license": {"spdx": "OFL-1.1", "file": "OFL.txt", "source": "node_modules/@fontsource/noto-sans-sc/LICENSE", "sha256": base.digest(license_bytes)},
                    "tools": {"fonttools": base.FONTTOOLS_VERSION, "brotli": base.BROTLI_VERSION},
                    "coverageRule": "The two disjoint 400 faces together cover all pin-fin page text (first-screen and below-the-fold copy) in both locales, the five-part collection, runtime copy and the shared shell; 500/600/700 cover only the CSS-mapped emphasis copy. Latin remains Geist; symbols outside the original master use existing fallbacks.",
                    "weightRules": WEIGHT_RULES,
                    "verifiedSelectors": [{"source": source, "selector": selector, "weight": weight} for source, selector, weight in VERIFIED_SELECTORS],
                    "sourceBindings": inputs, "faces": faces}
        MANIFEST.write_text(json.dumps(encode_hashes(manifest), indent=2) + "\n", encoding="utf-8", newline="\n")
        CSS.write_text("\n".join(css) + "\n", encoding="utf-8", newline="\n")
        subprocess.run(["node", str(ROOT / "node_modules/prettier/bin/prettier.cjs"), "--write", str(MANIFEST), str(CSS)], cwd=ROOT, check=True)
    manifest = decode_hashes(json.loads(MANIFEST.read_text(encoding="utf-8")))
    assert manifest["sourceBindings"] == inputs, "Source bindings changed; regenerate fonts"
    assert [(face["id"], face["weight"]) for face in manifest["faces"]] == list(FACES)
    assert (OUTPUT / "OFL.txt").read_bytes() == license_bytes
    for face in manifest["faces"]:
        source, output = base.PACKAGE / face["source"], OUTPUT / face["file"]
        assert base.digest(source.read_bytes()) == face["sourceSha256"]
        assert base.digest(output.read_bytes()) == face["sha256"]
        with TTFont(source, recalcTimestamp=False) as original:
            expected = requested[face["id"]] & set(original.getBestCmap())
        assert expected == {int(code[2:], 16) for code in face["codepoints"]}, "Copy changed; regenerate fonts"
        base.verify_face(source, output, expected, face["weight"])
    verify_css(manifest["faces"])
    total = sum(face["bytes"] for face in manifest["faces"])
    print(f"PASS: five pin-fin faces, {total} bytes; exact outlines, metrics, weights, coverage, metadata and license", flush=True)


if __name__ == "__main__":
    main()
