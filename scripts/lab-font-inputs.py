"""Shared deterministic lab-font source inventory, including runtime strings."""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTENSIONS = {'.astro', '.ts', '.json'}


def read(relative, bindings):
    file = ROOT / relative
    data = file.read_bytes()
    bindings[relative] = hashlib.sha256(data).hexdigest()
    return data.decode('utf-8-sig')


def dictionary_sections(keys, bindings):
    source = read('src/i18n/dictionaries.ts', bindings)
    return ''.join(match[1] for key in keys for match in re.finditer(r'^  ' + key + r': \{(.*?)^  \},', source, re.M | re.S))


def shell(bindings):
    text = dictionary_sections(('nav', 'common'), bindings)
    for locale in ('zh', 'en'):
        home = json.loads(read(f'src/content/home/{locale}.json', bindings))
        text += ''.join(home[key] for key in ('name', 'navWork', 'navLab'))
        text += json.dumps(home['footer'], ensure_ascii=False)
    for name in ('Header', 'Footer'):
        text += read(f'src/components/{name}.astro', bindings)
    for file in ('src/styles/global.css', 'src/styles/navigation.css', 'src/styles/thermal-tokens.css', 'src/styles/tokens.css', 'src/layouts/BaseLayout.astro'):
        read(file, bindings)
    return text


def component_text(directory, bindings):
    text = shell(bindings)
    for folder in (ROOT / 'src/components/lab' / directory, ROOT / 'src/components/lab/_shared'):
        for file in sorted(folder.rglob('*')):
            if file.is_file() and file.suffix in EXTENSIONS and 'model' not in file.relative_to(folder).parts:
                text += read(file.relative_to(ROOT).as_posix(), bindings)
    for file in sorted((ROOT / 'src/components/lab' / directory).glob('*.css')):
        if not file.name.endswith('-fonts.css'):
            read(file.relative_to(ROOT).as_posix(), bindings)
    page = json.loads(read(f'src/components/lab/{directory}/page.json', bindings))
    for locale in ('zh', 'en'):
        text += read(f"src/content/lab/{locale}/{page['slug']}.md", bindings)
    if directory == 'half-bridge':
        for file in sorted((ROOT / 'src/content/halfBridgeParts').glob('*.json')):
            text += read(file.relative_to(ROOT).as_posix(), bindings)
    return text


def catalog(bindings):
    descriptors = {}
    for file in sorted((ROOT / 'src/components/lab').glob('*/page.json')):
        page = json.loads(read(file.relative_to(ROOT).as_posix(), bindings))
        descriptors[page['slug']] = page
    return descriptors


def index_text(bindings):
    read('src/styles/lab-index.css', bindings)
    text = shell(bindings) + dictionary_sections(('lab',), bindings)
    headings = shell(bindings)
    descriptors = catalog(bindings)
    installed = {page['code'] for page in descriptors.values()}
    for locale in ('zh', 'en'):
        home = json.loads(read(f'src/content/home/{locale}.json', bindings))['lab']
        text += home['title'] + home['kicker'] + home['allLabel']
        headings += home['title']
        for card in home['planned']:
            code = re.match(r'^[LS][0-9]+', card['label'])
            if not code or code[0] not in installed:
                text += json.dumps(card, ensure_ascii=False)
                headings += card['label'] + card['title']
    for file in sorted((ROOT / 'src/content/lab').glob('*/*.md')):
        source = read(file.relative_to(ROOT).as_posix(), bindings)
        frontmatter = source.split('---', 2)[1]
        for key in ('title', 'summary', 'status', 'kind'):
            match = re.search(r'^' + key + r':\s*(.+)$', frontmatter, re.M)
            if not match:
                raise ValueError(f'Lab index frontmatter must expose scalar {key}: {file}')
            text += match[1]
            if key == 'title':
                headings += match[1]
    for name in ('LabIndex', 'LabCard'):
        markup = read(f'src/components/{name}.astro', bindings)
        text += markup
        # Include literal translated headings; all prose stays in the 400 face.
        headings += ''.join(re.findall(r'<h[1-6][^>]*>(.*?)</h[1-6]>', markup, re.S))
    return {400: text, 700: headings}


def fallback_text(bindings):
    text = shell(bindings) + dictionary_sections(('lab', 'demo'), bindings)
    # Registered pages own their text/fonts; adding one must not rebind generic assets.
    descriptors = catalog({})
    for file in sorted((ROOT / 'src/content/lab').glob('*/*.md')):
        source = file.read_text(encoding='utf-8-sig')
        slug = re.search(r'^translationKey:\s*(.+)$', source, re.M)[1].strip('"\'')
        if slug not in descriptors:
            text += read(file.relative_to(ROOT).as_posix(), bindings)
    for name in ('LabDetail', 'DemoPanel'):
        text += read(f'src/components/{name}.astro', bindings)
    for file in sorted((ROOT / 'src/scripts').glob('demos*')):
        if file.is_file():
            text += read(file.relative_to(ROOT).as_posix(), bindings)
    # Generic Markdown permits strong/emphasis anywhere, so both real weights
    # cover its complete text. Registered interactive pages keep smaller maps.
    return {400: text, 700: text}


def encode_bindings(bindings):
    """Lossless grouped SHA-256 values; concatenate eight groups to recover."""
    return {file: [digest[index:index + 8] for index in range(0, 64, 8)] for file, digest in bindings.items()}


def decode_bindings(bindings):
    return {file: ''.join(digest) if isinstance(digest, list) else digest for file, digest in bindings.items()}
