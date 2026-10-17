import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectWoff2 } from './inspect-woff2.mjs';
import { collectLabFontInputs, composeLabIndexFonts, codeLabel } from './compose-lab-fonts.mjs';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const fontPackage = path.dirname(require.resolve('@fontsource/noto-sans-sc/package.json'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const recordedHash = (value) => (Array.isArray(value) ? value.join('') : value);
const json = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

function checkedFile(base, relative, expected, bytes) {
  const resolved = path.resolve(base, relative);
  if (!resolved.startsWith(`${base}${path.sep}`))
    throw Error('Font manifest path escapes its root.');
  const data = readFileSync(resolved);
  if (hash(data) !== recordedHash(expected) || (bytes !== undefined && data.byteLength !== bytes))
    throw Error(`Lab font source/asset changed: ${relative}. Regenerate its subsets.`);
  return data;
}

function manifests(projectRoot) {
  const components = path.join(projectRoot, 'src/components/lab');
  const pages = readdirSync(components, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(path.join(components, entry.name, 'page.json')),
    )
    .map((entry) => ({
      directory: entry.name,
      page: json(path.join(components, entry.name, 'page.json')),
    }))
    .sort((a, b) => a.page.slug.localeCompare(b.page.slug, 'en'));
  const list = ['index', 'fallback'].map((scope) => ({
    scope,
    manifest: path.join(projectRoot, `public/fonts/noto-sans-sc-lab-${scope}-manifest.json`),
    css: path.join(projectRoot, `src/styles/lab-${scope}-fonts.css`),
  }));
  for (const { directory, page } of pages) {
    const legacy = { 'half-bridge': 'half-bridge', 'thermal-stack': 'thermal' }[directory];
    const folder = legacy
      ? path.join(projectRoot, 'public/fonts')
      : path.join(projectRoot, `public/models/${page.slug}/fonts`);
    const name = legacy ?? page.slug;
    list.push({
      scope: 'page',
      requiredBindings: [
        `src/components/lab/${directory}/page.json`,
        ...['zh', 'en'].map((locale) => `src/content/lab/${locale}/${page.slug}.md`),
      ],
      manifest: path.join(folder, `noto-sans-sc-${name}-manifest.json`),
      css: path.join(components, directory, `${name}-fonts.css`),
    });
  }
  return { list, pages };
}

export function checkLabFonts({ projectRoot = root } = {}) {
  projectRoot = path.resolve(projectRoot);
  const { list, pages } = manifests(projectRoot);
  const packageVersion = json(path.join(fontPackage, 'package.json')).version;
  const sourceFonts = new Map();
  const verified = { index: [], fallback: [], page: [] };
  for (const { scope, requiredBindings = [], manifest: manifestFile, css: cssFile } of list) {
    if (!existsSync(manifestFile))
      throw Error(
        `Missing lab subset manifest: ${path.relative(projectRoot, manifestFile)}. Generate page fonts before building.`,
      );
    const manifest = json(manifestFile);
    if (
      manifest.package !== '@fontsource/noto-sans-sc' ||
      manifest.packageVersion !== packageVersion
    )
      throw Error('Lab font provenance differs from locked Noto package.');
    const bindings =
      manifest.sourceBindings ??
      Object.entries(manifest.sourceInputsSha256 ?? {}).map(([file, sha256]) => ({
        path: file,
        sha256,
      }));
    if (!bindings.length) throw Error(`Lab font manifest has no source bindings: ${manifestFile}`);
    for (const file of requiredBindings) {
      if (!bindings.some((binding) => binding.path === file))
        throw Error(
          `Page font manifest must bind its own descriptor and both locale content files: ${file}`,
        );
    }
    for (const binding of bindings) checkedFile(projectRoot, binding.path, binding.sha256);
    // catalogSlugs is the authoring snapshot, not a closed registry. New pages
    // are admitted only after their assets and current index/generic coverage pass below.
    const folder = path.dirname(manifestFile);
    checkedFile(folder, manifest.license.file, manifest.license.sha256);
    const css = readFileSync(cssFile, 'utf8');
    const blocks = [...css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)].map((match) => match[1]);
    if (
      blocks.length !== manifest.faces.length ||
      /node_modules|@fontsource|noto-sans-sc-\d+-/.test(css)
    )
      throw Error(`Lab fonts must use only their verified checked-in subsets: ${cssFile}`);
    for (const face of manifest.faces) {
      if (
        path.basename(face.file) !== face.file ||
        !/^files\/[a-z0-9-]+\.woff2$/.test(face.source) ||
        ![400, 500, 600, 700].includes(face.weight)
      )
        throw Error('Invalid lab font face.');
      const data = checkedFile(folder, face.file, face.sha256, face.bytes);
      const sourceBytes = checkedFile(fontPackage, face.source, face.sourceSha256);
      if (!sourceFonts.has(face.source)) sourceFonts.set(face.source, inspectWoff2(sourceBytes));
      const sourceFont = sourceFonts.get(face.source);
      const font = inspectWoff2(data);
      const actualCodes = [...font.codes].sort((a, b) => a - b).map(codeLabel);
      if (
        JSON.stringify(actualCodes) !== JSON.stringify(face.codepoints) ||
        [...font.codes].some((code) => !sourceFont.codes.has(code))
      )
        throw Error(`Lab font recorded coverage differs from its actual cmap: ${face.file}`);
      if (font.weight !== face.weight || sourceFont.weight !== face.weight)
        throw Error(`Lab font weight differs from its original source: ${face.file}`);
      const block = blocks.find((entry) => entry.includes(face.file));
      if (
        !block ||
        !/font-display:\s*(optional|swap)\s*;/.test(block) ||
        Number(block.match(/font-weight:\s*(\d+)/)?.[1]) !== face.weight
      )
        throw Error('Lab fonts must retain their original weight and be nonblocking.');
      const ranges = block.match(/unicode-range:\s*([^;]+)/)?.[1].match(/U\+[0-9A-F]{4,6}/g) ?? [];
      if (JSON.stringify(ranges.slice().sort()) !== JSON.stringify(face.codepoints.slice().sort()))
        throw Error(`Lab font CSS coverage differs from verified cmap: ${face.file}`);
      const url =
        '/' +
        path
          .relative(path.join(projectRoot, 'public'), path.join(folder, face.file))
          .split(path.sep)
          .join('/');
      if (!block.includes(url))
        throw Error(`Lab font URL does not reference its verified asset: ${face.file}`);
      verified[scope].push({ ...face, codes: font.codes, sourceCodes: sourceFont.codes, url });
    }
    if (
      ['index', 'fallback'].includes(scope) &&
      (manifest.faces.length !== 2 ||
        manifest.faces.map((face) => face.weight).join(',') !== '400,700')
    )
      throw Error('Shared lab families must retain the two real 400/700 Chinese weights.');
  }
  const inputs = collectLabFontInputs(projectRoot, pages);
  const required = (codes, weight) => {
    const original = verified.index.find((face) => face.weight === weight).sourceCodes;
    const unsupportedHan = [...codes].filter(
      (code) => !original.has(code) && /\p{Script=Han}/u.test(String.fromCodePoint(code)),
    );
    if (unsupportedHan.length)
      throw Error(
        `Chinese glyph is outside locked Noto master: ${unsupportedHan.map(codeLabel).join(', ')}`,
      );
    return new Set([...codes].filter((code) => original.has(code)));
  };
  const requested = Object.fromEntries(
    [400, 700].map((weight) => [weight, required(inputs.index[weight], weight)]),
  );
  const index = composeLabIndexFonts(verified.index, verified.page, requested);
  for (const weight of [400, 700]) {
    const face = verified.fallback.find((entry) => entry.weight === weight);
    const missing = [...required(inputs.fallback, weight)].filter((code) => !face.codes.has(code));
    if (missing.length)
      throw Error(
        `Generic lab content has no verified ${weight} subset for ${missing.map(codeLabel).join(', ')}. Regenerate generic lab fonts.`,
      );
  }
  return {
    manifests: list.length,
    registeredPages: pages.length,
    indexCss: index.css,
    indexSelections: index.selections,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkLabFonts();
  console.log(
    `Lab fonts: ${result.manifests} source-bound manifests, actual cmap/weights and current index/generic coverage checked; no fragment fallback CSS.`,
  );
}
