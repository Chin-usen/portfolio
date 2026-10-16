"""Regenerate checked-in, content-only Noto Sans SC WOFF2 assets.

Optional authoring tool; ordinary pnpm builds use the checked-in assets and Node.
Install scripts/font-subset-requirements.txt in an isolated Python environment.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import brotli
import fontTools
from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont
from fontTools.unicodedata import mirrored

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "node_modules/@fontsource/noto-sans-sc"
OUTPUT = ROOT / "public/fonts"
WEIGHTS = (400, 500, 600, 700)
EXTENSIONS = {".astro", ".ts", ".md", ".yaml", ".yml", ".json"}
FONTTOOLS_VERSION = "4.65.0"
BROTLI_VERSION = "1.2.0"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_codepoints() -> set[int]:
    return {
        ord(character)
        for file in (ROOT / "src").rglob("*")
        if file.is_file() and file.suffix in EXTENSIONS
        for character in file.read_text(encoding="utf-8-sig")
        if ord(character) > 127
    }


def home_common_codepoints() -> set[int]:
    # A deterministic authoring partition: no browser or generated build is needed.
    paths = [ROOT / "src/content/home" / f"{locale}.json" for locale in ("zh", "en")]
    paths += [ROOT / "src/components" / f"{name}.astro" for name in ("HomePage", "Header", "Footer")]
    text = "".join(file.read_text(encoding="utf-8-sig") for file in paths)
    dictionary = (ROOT / "src/i18n/dictionaries.ts").read_text(encoding="utf-8-sig")
    for key in ("nav", "common"):
        match = re.search(r"  " + key + r": \{(.*?)\n  \},", dictionary, re.S)
        if not match:
            raise SystemExit(f"Review Home/common partition after dictionary structure change: {key}")
        text += match[1]
    return {ord(character) for character in text if ord(character) > 127}


def codepoints(values: set[int]) -> list[str]:
    return [f"U+{value:04X}" for value in sorted(values)]


def outline(font: TTFont, character: int) -> list:
    glyphs = font.getGlyphSet()
    pen = DecomposingRecordingPen(glyphs)
    glyphs[font.getBestCmap()[character]].draw(pen)
    return pen.value


def verify_face(source: Path, output: Path, coverage: set[int], weight: int) -> None:
    with TTFont(source, recalcTimestamp=False) as original, TTFont(
        output, recalcTimestamp=False
    ) as result:
        assert set(result.getBestCmap()) == coverage, "Subset cmap differs from manifest"
        assert original["OS/2"].usWeightClass == result["OS/2"].usWeightClass == weight
        assert original["head"].unitsPerEm == result["head"].unitsPerEm
        for field in ("ascent", "descent", "lineGap"):
            assert getattr(original["hhea"], field) == getattr(result["hhea"], field)
        for field in ("sTypoAscender", "sTypoDescender", "sTypoLineGap", "usWinAscent", "usWinDescent"):
            assert getattr(original["OS/2"], field) == getattr(result["OS/2"], field)
        original_cmap = original.getBestCmap()
        result_cmap = result.getBestCmap()
        for character in coverage:
            assert original["hmtx"][original_cmap[character]] == result["hmtx"][result_cmap[character]]
            assert outline(original, character) == outline(result, character), f"Changed outline: U+{character:04X}"
        original_names = {(name.nameID, name.toUnicode()) for name in original["name"].names}
        result_names = {(name.nameID, name.toUnicode()) for name in result["name"].names}
        assert original_names <= result_names, "Original name/copyright/license metadata lost"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check hashes, cmap, weights, metrics, and every retained outline")
    args = parser.parse_args()
    if fontTools.__version__ != FONTTOOLS_VERSION or brotli.__version__ != BROTLI_VERSION:
        raise SystemExit("Use the pinned versions in scripts/font-subset-requirements.txt")
    package = json.loads((PACKAGE / "package.json").read_text(encoding="utf-8"))
    if package["version"] != "5.3.1":
        raise SystemExit("Review font provenance before regenerating from a new package version")
    requested = source_codepoints()
    requested |= {mirror for code in tuple(requested) if (mirror := mirrored(code)) is not None}
    common = home_common_codepoints()
    common |= {mirror for code in tuple(common) if (mirror := mirrored(code)) is not None}
    if args.check:
        manifest = json.loads((OUTPUT / "noto-sans-sc-subset-manifest.json").read_text(encoding="utf-8"))
        for face in manifest["faces"]:
            source = PACKAGE / face["source"]
            output = OUTPUT / face["file"]
            assert digest(source.read_bytes()) == face["sourceSha256"]
            assert digest(output.read_bytes()) == face["sha256"]
            assert output.stat().st_size == face["bytes"]
            verify_face(source, output, {int(value[2:], 16) for value in face["codepoints"]}, face["weight"])
        assert digest((OUTPUT / "OFL.txt").read_bytes()) == manifest["license"]["sha256"]
        print(f"PASS: {len(manifest['faces'])} subset hashes, cmap coverage, exact outlines, advance/line metrics, real weights, and original font metadata")
        return
    OUTPUT.mkdir(parents=True, exist_ok=True)
    license_bytes = (PACKAGE / "LICENSE").read_bytes()
    (OUTPUT / "OFL.txt").write_bytes(license_bytes)
    faces = []
    for weight in WEIGHTS:
        main_source = f"files/noto-sans-sc-chinese-simplified-{weight}-normal.woff2"
        with TTFont(PACKAGE / main_source, recalcTimestamp=False) as font:
            primary = requested & font.getBestCmap().keys()
        groups = [("common", main_source, set(primary & common)),
                  ("content", main_source, set(primary - common))]
        remaining = requested - primary
        # Preserve the original glyph for symbols outside the Simplified Chinese
        # cmap, without downloading a 32KB source chunk for a single arrow.
        css = (PACKAGE / f"{weight}.css").read_text(encoding="utf-8")
        for block in re.findall(r"@font-face\s*\{(.*?)\}", css, re.S):
            match = re.search(r"\./(files/[^')]+\.woff2)", block)
            ranges = re.search(r"unicode-range:\s*([^;]+)", block)
            if not match or not ranges:
                continue
            intervals = [(int(low, 16), int(high or low, 16)) for low, high in
                         re.findall(r"U\+([0-9a-f]+)(?:-([0-9a-f]+))?", ranges[1], re.I)]
            included = {code for code in remaining if any(low <= code <= high for low, high in intervals)}
            if not included:
                continue
            source_relative = match[1]
            with TTFont(PACKAGE / source_relative, recalcTimestamp=False) as font:
                included &= font.getBestCmap().keys()
            if included:
                group = "symbols-" + Path(source_relative).stem.removeprefix("noto-sans-sc-").removesuffix(f"-{weight}-normal")
                groups.append((group, source_relative, included))
                remaining -= included
        for group, source_relative, coverage in groups:
            source = PACKAGE / source_relative
            output = OUTPUT / f"noto-sans-sc-{group}-{weight}-normal.woff2"
            with TTFont(source, recalcTimestamp=False) as font:
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
                font.save(output, reorderTables=True)
            verify_face(source, output, coverage, weight)
            face = {
                "weight": weight,
                "style": "normal",
                "group": group,
                "source": source_relative,
                "sourceBytes": source.stat().st_size,
                "sourceSha256": digest(source.read_bytes()),
                "file": output.name,
                "bytes": output.stat().st_size,
                "sha256": digest(output.read_bytes()),
                "codepoints": codepoints(coverage),
            }
            faces.append(face)
            print(f"{weight} {group}: {face['bytes']:,} bytes / {len(coverage)} code points; exact outlines and metrics verified")
    manifest = {
        "format": "noto-content-subsets-v2",
        "family": "Noto Sans SC",
        "package": "@fontsource/noto-sans-sc",
        "packageVersion": package["version"],
        "upstream": "https://github.com/fontsource/font-files/tree/main/fonts/google/noto-sans-sc",
        "license": {"spdx": "OFL-1.1", "file": "OFL.txt", "sha256": digest(license_bytes)},
        "tools": {"fonttools": FONTTOOLS_VERSION, "brotli": BROTLI_VERSION},
        "command": "python scripts/subset-noto-fonts.py",
        "coverageRule": "Non-ASCII literal code points in src/**/*.{astro,ts,md,yaml,yml,json}; partitioned into disjoint Home/common, remaining content, and original chunk symbol cmaps",
        "commonPartitionRule": "Home zh/en JSON, HomePage/Header/Footer component literals, and first (Chinese) dictionary nav/common blocks; mirrored Unicode pairs remain in the same partition",
        "commonPartitionCodepoints": codepoints(common),
        "requestedCodepoints": codepoints(requested),
        "originalChunkFallbackCodepoints": codepoints(requested - {int(value[2:], 16) for face in faces if face["weight"] == 400 for value in face["codepoints"]}),
        "faces": faces,
    }
    (OUTPUT / "noto-sans-sc-subset-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Total four-weight font transfer: {sum(face['bytes'] for face in faces):,} bytes")


if __name__ == "__main__":
    main()
