import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLabFonts } from './check-lab-fonts.mjs';
import { checkWorkFonts } from './check-work-fonts.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const weights = [400, 500, 600, 700];
const fontDirectory = path.join(root, 'public/fonts');
const manifestPath = path.join(fontDirectory, 'noto-sans-sc-subset-manifest.json');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

export function collectSourceCodepoints() {
  const chars = new Set();
  function collect(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (/\.(astro|ts|md|yaml|yml|json)$/.test(entry.name))
        for (const character of readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) {
          const code = character.codePointAt(0);
          if (code > 127) chars.add(code);
        }
    }
  }
  collect(path.join(root, 'src'));
  return chars;
}

function unicodeRange(codes) {
  const sorted = [...codes].sort((a, b) => a - b);
  const ranges = [];
  for (const code of sorted) {
    const last = ranges.at(-1);
    if (last && last[1] + 1 === code) last[1] = code;
    else ranges.push([code, code]);
  }
  return ranges
    .map(([low, high]) =>
      low === high
        ? `U+${low.toString(16).toUpperCase()}`
        : `U+${low.toString(16).toUpperCase()}-${high.toString(16).toUpperCase()}`,
    )
    .join(',');
}

function faceCss(weight, url, codes) {
  return `@font-face {\n  font-family: 'Noto Sans SC';\n  font-style: normal;\n  font-display: swap;\n  font-weight: ${weight};\n  src: url('${url}') format('woff2');\n  unicode-range: ${unicodeRange(codes)};\n}`;
}

function loadSubsets() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const packagePath = require.resolve('@fontsource/noto-sans-sc/package.json');
  const packageInfo = JSON.parse(readFileSync(packagePath, 'utf8'));
  if (
    manifest.format !== 'noto-content-subsets-v2' ||
    manifest.family !== 'Noto Sans SC' ||
    manifest.packageVersion !== packageInfo.version
  ) {
    throw new Error(
      'Noto subset provenance differs from the locked package; review and regenerate.',
    );
  }
  for (const weight of weights) {
    if (!manifest.faces.some((face) => face.weight === weight && face.group === 'content'))
      throw new Error('Expected four real font weights.');
    const coverage = new Set();
    for (const face of manifest.faces.filter((entry) => entry.weight === weight)) {
      for (const code of face.codepoints) {
        if (coverage.has(code)) throw new Error('Noto subset coverage must be disjoint.');
        coverage.add(code);
      }
    }
  }
  for (const face of manifest.faces) {
    const { weight } = face;
    if (
      !weights.includes(weight) ||
      path.basename(face.file) !== face.file ||
      !/^files\/[a-z0-9-]+\.woff2$/.test(face.source)
    )
      throw new Error('Invalid Noto subset manifest.');
    const data = readFileSync(path.join(fontDirectory, face.file));
    const source = readFileSync(path.join(path.dirname(packagePath), face.source));
    if (
      data.byteLength !== face.bytes ||
      sha256(data) !== face.sha256 ||
      sha256(source) !== face.sourceSha256
    ) {
      throw new Error(`Noto ${weight} font hash differs from its recorded provenance.`);
    }
    if (!face.codepoints.every((value) => /^U\+[0-9A-F]{4,6}$/.test(value))) {
      throw new Error(`Invalid Noto ${weight} Unicode coverage.`);
    }
  }
  const license = readFileSync(path.join(fontDirectory, manifest.license.file));
  if (sha256(license) !== manifest.license.sha256)
    throw new Error('Noto OFL license hash mismatch.');
  return manifest.faces;
}

export function generateFontCss(chars = collectSourceCodepoints()) {
  const subsets = loadSubsets();
  const faces = [];
  let subsetFaces = 0;
  let fallbackFaces = 0;
  const fallbackCodepoints = new Set();
  const uncoveredCodepoints = new Set();
  for (const weight of weights) {
    const covered = new Set();
    for (const subset of subsets.filter((face) => face.weight === weight)) {
      const coverage = new Set(subset.codepoints.map((value) => parseInt(value.slice(2), 16)));
      for (const code of coverage) covered.add(code);
      const selected = [...chars].filter((code) => coverage.has(code));
      if (selected.length) {
        faces.push(faceCss(weight, `/fonts/${subset.file}`, selected));
        subsetFaces += 1;
      }
    }
    // Only glyphs absent from the checked-in subset use the original locked chunks.
    // New editorial text therefore works immediately without Python or regeneration.
    const remaining = new Set([...chars].filter((code) => !covered.has(code)));
    const source = readFileSync(require.resolve(`@fontsource/noto-sans-sc/${weight}.css`), 'utf8');
    for (const block of source.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)) {
      const ranges = block[1].match(/unicode-range:\s*([^;]+)/)?.[1];
      const filename = block[1].match(/\.\/files\/([^')]+\.woff2)/)?.[1];
      if (!ranges || !filename) continue;
      const intervals = [...ranges.matchAll(/U\+([0-9a-f]+)(?:-([0-9a-f]+))?/gi)].map((match) => [
        parseInt(match[1], 16),
        parseInt(match[2] ?? match[1], 16),
      ]);
      const included = [...remaining].filter((code) =>
        intervals.some(([low, high]) => code >= low && code <= high),
      );
      if (!included.length) continue;
      faces.push(
        faceCss(weight, `../../node_modules/@fontsource/noto-sans-sc/files/${filename}`, included),
      );
      fallbackFaces += 1;
      for (const code of included) {
        fallbackCodepoints.add(code);
        remaining.delete(code);
      }
    }
    for (const code of remaining) uncoveredCodepoints.add(code);
  }
  if (!faces.length) throw new Error('No pinned Noto font faces matched the source content.');
  return {
    css:
      '/* Generated from checked-in OFL Noto subsets plus locked source chunks for new glyphs. */\n' +
      faces.join('\n') +
      '\n',
    subsetFaces,
    fallbackFaces,
    fallbackCodepoints,
    uncoveredCodepoints,
  };
}

function checkFutureGlyphFallback() {
  const subsets = loadSubsets();
  const current = collectSourceCodepoints();
  const covered = new Set(
    subsets.flatMap((face) => face.codepoints.map((value) => parseInt(value.slice(2), 16))),
  );
  const candidate = Array.from({ length: 0x9fff - 0x4e00 + 1 }, (_, index) => 0x4e00 + index).find(
    (code) => !covered.has(code) && !current.has(code),
  );
  const probe = generateFontCss(new Set([candidate]));
  if (probe.subsetFaces || probe.fallbackFaces !== 4 || !probe.fallbackCodepoints.has(candidate)) {
    throw new Error('Future CJK content did not retain all four original font weights.');
  }
  console.log(
    `Future-text check: ${unicodeRange([candidate])} uses all four original locked faces.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkWorkFonts();
  const lab = checkLabFonts();
  const labOutputPath = path.join(root, 'src/styles/lab-index-composed-fonts.css');
  if (process.argv.includes('--check')) {
    if (readFileSync(labOutputPath, 'utf8') !== lab.indexCss)
      throw new Error('Generated lab index CSS is stale.');
  } else writeFileSync(labOutputPath, lab.indexCss);
  const result = generateFontCss();
  const outputPath = path.join(root, 'src/styles/generated-fonts.css');
  if (process.argv.includes('--check')) {
    if (readFileSync(outputPath, 'utf8') !== result.css)
      throw new Error('Generated Noto CSS is stale.');
    checkFutureGlyphFallback();
  } else writeFileSync(outputPath, result.css);
  console.log(
    `Noto CSS: ${result.subsetFaces} content subsets + ${result.fallbackFaces} original fallback faces, ${Buffer.byteLength(result.css)} bytes.`,
  );
  if (result.uncoveredCodepoints.size) {
    console.log(
      `Code points outside the original Noto package retain the CSS font stack: ${unicodeRange(result.uncoveredCodepoints)}.`,
    );
  }
}
