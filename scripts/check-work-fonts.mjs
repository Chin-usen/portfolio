import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectWoff2 } from './inspect-woff2.mjs';
import {
  collectWorkFontInputs,
  workFontCss,
  workFontFamily,
  workFontWeights,
  codeLabel,
} from './work-font-inputs.mjs';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const packageRoot = path.dirname(require.resolve('@fontsource/noto-sans-sc/package.json'));
const json = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const normalize = (text) => text.replace(/\s/g, '');
function checkedFile(directory, file, expected, size) {
  if (path.basename(file) !== file) throw Error('Invalid Work font asset path.');
  const bytes = readFileSync(path.join(directory, file));
  if (
    !Array.isArray(expected) ||
    expected.length !== 8 ||
    !expected.every((group) => /^[0-9a-f]{8}$/.test(group)) ||
    hash(bytes) !== expected.join('') ||
    (size !== undefined && bytes.byteLength !== size)
  )
    throw Error(`Work font source/asset changed: ${file}`);
  return bytes;
}

export function checkWorkFonts({ projectRoot = root } = {}) {
  const folder = path.join(projectRoot, 'public/fonts/work-detail');
  const manifest = json(path.join(folder, 'noto-sans-sc-work-detail-manifest.json'));
  const inventory = collectWorkFontInputs(projectRoot);
  if (
    !equal(manifest.sourceInputsSha256, inventory.sourceInputsSha256) ||
    !equal(manifest.requestedCodepoints, inventory.requestedCodepoints)
  )
    throw Error('Work content/shell/source inventory changed; regenerate Work detail subsets.');
  if (
    manifest.format !== 'noto-work-detail-subsets-v1' ||
    manifest.family !== workFontFamily ||
    manifest.package !== '@fontsource/noto-sans-sc' ||
    manifest.packageVersion !== json(path.join(packageRoot, 'package.json')).version
  )
    throw Error('Work font provenance differs from the locked Noto package.');
  const license = checkedFile(folder, manifest.license.file, manifest.license.sha256);
  if (
    manifest.license.spdx !== 'OFL-1.1' ||
    !license.equals(readFileSync(path.join(packageRoot, 'LICENSE')))
  )
    throw Error('Work font original OFL license changed.');
  if (
    !equal(
      manifest.faces.map((face) => face.weight),
      workFontWeights,
    )
  )
    throw Error('Work fonts must preserve all four actual weights.');
  for (const face of manifest.faces) {
    const filename = `noto-sans-sc-work-detail-${face.weight}-normal.woff2`;
    if (
      face.file !== filename ||
      face.style !== 'normal' ||
      face.source !== `files/noto-sans-sc-chinese-simplified-${face.weight}-normal.woff2`
    )
      throw Error('Unexpected Work font face/source.');
    const font = inspectWoff2(checkedFile(folder, face.file, face.sha256, face.bytes));
    const original = inspectWoff2(
      checkedFile(path.join(packageRoot, 'files'), path.basename(face.source), face.sourceSha256),
    );
    if (
      font.weight !== face.weight ||
      original.weight !== face.weight ||
      !equal([...font.codes].sort((a, b) => a - b).map(codeLabel), face.codepoints) ||
      [...font.codes].some((code) => !original.codes.has(code))
    )
      throw Error('Work font actual cmap/weight differs from its recorded original.');
    const expectedFallback = new Set(face.systemFallbackCodepoints);
    for (const label of inventory.requestedCodepoints) {
      const code = parseInt(label.slice(2), 16);
      if (original.codes.has(code) ? !font.codes.has(code) : !expectedFallback.has(label))
        throw Error(`Missing Work glyph at ${face.weight}: ${label}`);
      if (code >= 0x3400 && code <= 0x9fff && !font.codes.has(code))
        throw Error(`Work Chinese text cannot use fallback: ${label}`);
    }
  }
  const css = readFileSync(path.join(projectRoot, 'src/styles/work-detail-fonts.css'), 'utf8');
  if (normalize(css) !== normalize(workFontCss(manifest.faces)))
    throw Error('Work font CSS differs from verified weight, asset, display or Unicode rules.');
  return {
    faces: manifest.faces.length,
    bytes: manifest.faces.reduce((sum, face) => sum + face.bytes, 0),
    requestedCodepoints: inventory.requestedCodepoints.length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log('Verified Work detail fonts:', JSON.stringify(checkWorkFonts()));
