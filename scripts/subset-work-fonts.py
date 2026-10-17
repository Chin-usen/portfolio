"""Authoring-only Work detail subsets; ordinary Node builds verify checked-in assets.

Preserves all four actual Noto weights, outlines, metrics and OFL metadata.
Run with scripts/font-subset-requirements.txt and pinned Node on PATH.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import subprocess
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.unicodedata import mirrored

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('work_font_base', ROOT / 'scripts/subset-noto-fonts.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
OUTPUT = ROOT / 'public/fonts/work-detail'
MANIFEST = OUTPUT / 'noto-sans-sc-work-detail-manifest.json'
CSS = ROOT / 'src/styles/work-detail-fonts.css'
WEIGHTS = (400, 500, 600, 700)


def grouped(value):
    return [value[index:index + 8] for index in range(0, 64, 8)]


def digest(file):
    return grouped(base.digest(file.read_bytes()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    assert base.fontTools.__version__ == base.FONTTOOLS_VERSION == '4.65.0'
    assert base.brotli.__version__ == base.BROTLI_VERSION == '1.2.0'
    package = json.loads((base.PACKAGE / 'package.json').read_text(encoding='utf-8'))
    assert package['version'] == '5.3.1'
    inventory = json.loads(subprocess.check_output(['node', 'scripts/work-font-inputs.mjs'], cwd=ROOT))
    requested = {int(code[2:], 16) for code in inventory['requestedCodepoints']}
    requested |= {mirror for code in tuple(requested) if (mirror := mirrored(code)) is not None}
    license_file = base.PACKAGE / 'LICENSE'
    if not args.check:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        (OUTPUT / 'OFL.txt').write_bytes(license_file.read_bytes())
        faces = []
        for weight in WEIGHTS:
            relative = f'files/noto-sans-sc-chinese-simplified-{weight}-normal.woff2'
            source = base.PACKAGE / relative
            with TTFont(source, recalcTimestamp=False) as font:
                coverage = requested & set(font.getBestCmap())
                assert not {code for code in requested - coverage if 0x3400 <= code <= 0x9FFF}, 'CJK text missing from original source'
                options = subset.Options()
                options.flavor = 'woff2'
                options.recalc_timestamp = False
                options.layout_features = ['*']
                options.name_IDs = ['*']
                options.name_languages = ['*']
                options.name_legacy = True
                options.glyph_names = True
                options.hinting = True
                subsetter = subset.Subsetter(options=options)
                subsetter.populate(unicodes=coverage)
                subsetter.subset(font)
                font.flavor = 'woff2'
                output = OUTPUT / f'noto-sans-sc-work-detail-{weight}-normal.woff2'
                font.save(output, reorderTables=True)
            base.verify_face(source, output, coverage, weight)
            faces.append({'weight': weight, 'style': 'normal', 'source': relative,
                          'sourceSha256': digest(source), 'file': output.name,
                          'bytes': output.stat().st_size, 'sha256': digest(output),
                          'codepoints': base.codepoints(coverage),
                          'systemFallbackCodepoints': base.codepoints(requested - coverage)})
            print(f'{weight}: {output.stat().st_size} bytes / {len(coverage)} original glyphs', flush=True)
        manifest = {'format': 'noto-work-detail-subsets-v1', 'family': 'Noto Sans SC Work Detail',
                    'package': '@fontsource/noto-sans-sc', 'packageVersion': package['version'],
                    'hashEncoding': 'SHA-256 values are eight ordered hexadecimal groups; concatenate without separators.',
                    'license': {'spdx': 'OFL-1.1', 'file': 'OFL.txt', 'sha256': digest(license_file)},
                    'tools': {'fonttools': base.FONTTOOLS_VERSION, 'brotli': base.BROTLI_VERSION},
                    'coverageRule': 'All Work detail entries in both locales, full Markdown, metrics, Work UI, shell/footer and every navigation state. Each real 400/500/600/700 master covers the entire set; weight and rendering rules are unchanged. Non-CJK symbols absent from the original source retain Geist/system fallback.',
                    **inventory, 'faces': faces}
        MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')
        css = subprocess.check_output(['node', 'scripts/work-font-inputs.mjs', '--css', str(MANIFEST)], cwd=ROOT)
        CSS.write_bytes(css)
        subprocess.run(['node', 'node_modules/prettier/bin/prettier.cjs', '--write', str(MANIFEST), str(CSS)], cwd=ROOT, check=True)
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    assert manifest['sourceInputsSha256'] == inventory['sourceInputsSha256'], 'Work source changed; regenerate work fonts'
    assert manifest['requestedCodepoints'] == inventory['requestedCodepoints']
    assert [face['weight'] for face in manifest['faces']] == list(WEIGHTS)
    for face in manifest['faces']:
        source, output = base.PACKAGE / face['source'], OUTPUT / face['file']
        with TTFont(source, recalcTimestamp=False) as font:
            coverage = requested & set(font.getBestCmap())
        assert face['codepoints'] == base.codepoints(coverage)
        assert face['systemFallbackCodepoints'] == base.codepoints(requested - coverage)
        assert digest(source) == face['sourceSha256'] and digest(output) == face['sha256']
        assert output.stat().st_size == face['bytes']
        base.verify_face(source, output, coverage, face['weight'])
    subprocess.run(['node', 'scripts/check-work-fonts.mjs'], cwd=ROOT, check=True)
    print(f"PASS Work detail: four actual weights, {sum(face['bytes'] for face in manifest['faces'])} bytes; exact outlines/metrics and current source coverage", flush=True)


if __name__ == '__main__':
    main()
