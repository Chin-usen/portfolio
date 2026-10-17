import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkLabFonts } from '../../scripts/check-lab-fonts.mjs';
import { inspectWoff2 } from '../../scripts/inspect-woff2.mjs';
import { composeLabIndexFonts } from '../../scripts/compose-lab-fonts.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const temporary: string[] = [];
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'lab-fonts-'));
  temporary.push(directory);
  cpSync(path.join(root, 'src'), path.join(directory, 'src'), { recursive: true });
  cpSync(path.join(root, 'public/fonts'), path.join(directory, 'public/fonts'), {
    recursive: true,
  });
  const components = path.join(root, 'src/components/lab');
  for (const entry of readdirSync(components, { withFileTypes: true })) {
    const descriptor = path.join(components, entry.name, 'page.json');
    if (!entry.isDirectory() || !existsSync(descriptor)) continue;
    const { slug } = readJson(descriptor);
    const fonts = path.join(root, `public/models/${slug}/fonts`);
    // Legacy page fonts already came with public/fonts; registered additions own this folder.
    if (existsSync(fonts))
      cpSync(fonts, path.join(directory, `public/models/${slug}/fonts`), { recursive: true });
  }
  return directory;
}

function fontFileInventory(directory: string, relative = ''): Array<[string, string]> {
  const files: Array<[string, string]> = [];
  for (const entry of readdirSync(path.join(directory, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...fontFileInventory(directory, file));
    else if (entry.isFile())
      files.push([
        file.split(path.sep).join('/'),
        digest(readFileSync(path.join(directory, file))),
      ]);
    else throw Error(`Unexpected non-regular font asset: ${file}`);
  }
  return files.sort(([left], [right]) => left.localeCompare(right, 'en'));
}

function futurePage(directory: string) {
  const baseline = checkLabFonts({ projectRoot: directory });
  const selectedCodes = new Set(baseline.indexSelections.flatMap((face) => face.codepoints));
  const pageFolder = path.join(directory, 'src/components/lab/future-page');
  const fontFolder = path.join(directory, 'public/models/future-page/fonts');
  mkdirSync(pageFolder, { recursive: true });
  cpSync(path.join(directory, 'public/models/rv-reducer/fonts'), fontFolder, { recursive: true });
  const manifest = readJson(path.join(fontFolder, 'noto-sans-sc-rv-reducer-manifest.json'));
  const base = readJson(path.join(directory, 'public/fonts/noto-sans-sc-lab-index-manifest.json'));
  const baseCodes = new Set(
    base.faces.flatMap((face: { codepoints: string[] }) => face.codepoints),
  );
  const code = manifest.faces[0].codepoints.find(
    (value: string) =>
      /^U\+[4-9]/.test(value) &&
      !baseCodes.has(value) &&
      !selectedCodes.has(parseInt(value.slice(2), 16)),
  );
  if (!code) throw Error('Independent-page fixture requires a genuinely new index glyph.');
  const text = String.fromCodePoint(parseInt(code.slice(2), 16));
  const files = [
    'src/components/lab/future-page/page.json',
    'src/content/lab/zh/future-page.md',
    'src/content/lab/en/future-page.md',
  ] as const;
  writeFileSync(
    path.join(directory, files[0]),
    JSON.stringify({ slug: 'future-page', code: 'L99' }),
  );
  for (const file of files.slice(1))
    writeFileSync(
      path.join(directory, file),
      `---\ntranslationKey: 'future-page'\ntitle: '${text}'\nsummary: '${text}'\nkind: 'teardown'\nstatus: '交互示意'\n---\n${text}\n`,
    );
  for (const file of files)
    manifest.sourceBindings.push({
      path: file,
      sha256: digest(readFileSync(path.join(directory, file))),
    });
  const manifestFile = path.join(fontFolder, 'noto-sans-sc-future-page-manifest.json');
  writeFileSync(manifestFile, JSON.stringify(manifest));
  const css = readFileSync(
    path.join(directory, 'src/components/lab/rv-reducer/rv-reducer-fonts.css'),
    'utf8',
  ).replaceAll('/models/rv-reducer/fonts/', '/models/future-page/fonts/');
  writeFileSync(path.join(pageFolder, 'future-page-fonts.css'), css);
  return { manifest, manifestFile, files, code, baseline };
}

describe('independent lab font coverage', () => {
  it('uses actual checked WOFF2 cmap/weight, retaining the 59,964-byte base and only two index weights', () => {
    const manifest = readJson(path.join(root, 'public/fonts/noto-sans-sc-lab-index-manifest.json'));
    expect(
      manifest.faces.reduce((sum: number, face: { bytes: number }) => sum + face.bytes, 0),
    ).toBe(59964);
    for (const face of manifest.faces) {
      const actual = inspectWoff2(readFileSync(path.join(root, 'public/fonts', face.file)));
      expect(actual.weight).toBe(face.weight);
      expect([...actual.codes].sort((a, b) => a - b)).toEqual(
        face.codepoints.map((code: string) => parseInt(code.slice(2), 16)),
      );
    }
    const result = checkLabFonts();
    expect(new Set(result.indexSelections.map((face) => face.weight))).toEqual(new Set([400, 700]));
    for (const face of result.indexSelections) {
      const actual = inspectWoff2(readFileSync(path.join(root, 'public', face.url)));
      expect(actual.weight).toBe(face.weight);
      expect(face.codepoints.every((code) => actual.codes.has(code))).toBe(true);
    }
    for (const face of manifest.faces)
      expect(
        result.indexSelections.some((selection) => selection.url === `/fonts/${face.file}`),
      ).toBe(true);
  });

  it('uses an honest regular fallback when a heading glyph has no 700 face', () => {
    const manifest = readJson(path.join(root, 'public/fonts/noto-sans-sc-lab-index-manifest.json'));
    const faces = manifest.faces.map((face: { file: string; weight: number; bytes: number }) => ({
      ...face,
      url: `/fonts/${face.file}`,
      codes: inspectWoff2(readFileSync(path.join(root, 'public/fonts', face.file))).codes,
    }));
    const regular = faces.find((face: { weight: number }) => face.weight === 400);
    const bold = faces.find((face: { weight: number }) => face.weight === 700);
    const code = [...regular.codes].find((value) => !bold.codes.has(value)) as number;
    const result = composeLabIndexFonts(faces, [], { 400: new Set([code]), 700: new Set([code]) });
    expect(result.selections.find((face) => face.requestedWeight === 700)).toMatchObject({
      weight: 400,
      regularFallback: true,
    });
    expect(result.css).toContain('Regular Fallback');
    expect(result.css).toContain('font-synthesis: none');
    expect(result.css).not.toContain('font-weight: 700');
  });

  it('admits an independently installed page using verified owned glyphs without rewriting shared fonts', () => {
    const directory = fixture();
    const before = fontFileInventory(path.join(directory, 'public/fonts'));
    expect(before.some(([file]) => file.startsWith('work-detail/'))).toBe(true);
    const added = futurePage(directory);
    const result = checkLabFonts({ projectRoot: directory });
    expect(result.registeredPages).toBe(added.baseline.registeredPages + 1);
    expect(added.baseline.indexSelections.flatMap((face) => face.codepoints)).not.toContain(
      parseInt(added.code.slice(2), 16),
    );
    const supplement = result.indexSelections.filter(
      (face) => !face.url.startsWith('/fonts/noto-sans-sc-lab-index-'),
    );
    expect(supplement.length).toBeGreaterThan(0);
    expect(
      supplement.some((face) => face.codepoints.includes(parseInt(added.code.slice(2), 16))),
    ).toBe(true);
    expect(new Set(result.indexSelections.map((face) => face.weight))).toEqual(new Set([400, 700]));
    expect(result.indexCss).not.toMatch(/font-weight: (500|600)|@fontsource|node_modules/);
    for (const weight of [400, 700]) {
      const ranges = result.indexSelections
        .filter((face) => face.requestedWeight === weight)
        .flatMap((face) => face.codepoints);
      expect(new Set(ranges).size).toBe(ranges.length);
    }
    expect(fontFileInventory(path.join(directory, 'public/fonts'))).toEqual(before);
  });

  it('refuses a new title glyph absent from every verified owned face', () => {
    const directory = fixture();
    const added = futurePage(directory);
    for (const file of added.files.slice(1)) {
      writeFileSync(
        path.join(directory, file),
        readFileSync(path.join(directory, file), 'utf8').replace(/title: .*/, "title: '龘'"),
      );
      added.manifest.sourceBindings.find(
        (binding: { path: string }) => binding.path === file,
      ).sha256 = digest(readFileSync(path.join(directory, file)));
    }
    writeFileSync(added.manifestFile, JSON.stringify(added.manifest));
    expect(() => checkLabFonts({ projectRoot: directory })).toThrow(
      /no verified subset|outside locked Noto/,
    );
  });

  it('refuses added generic body glyphs even when all index metadata is already covered', () => {
    const directory = fixture();
    for (const locale of ['zh', 'en'])
      writeFileSync(
        path.join(directory, `src/content/lab/${locale}/new-generic.md`),
        "---\ntranslationKey: 'new-generic'\ntitle: '实验台'\nsummary: '示意'\nkind: 'simulation'\nstatus: '示意'\n---\n龘\n",
      );
    expect(() => checkLabFonts({ projectRoot: directory })).toThrow(
      /Generic lab content|outside locked Noto/,
    );
  });

  it('refuses stale source text and a forged manifest cmap despite matching asset hashes', () => {
    const directory = fixture();
    const file = path.join(directory, 'src/content/lab/zh/sample-simulation.md');
    writeFileSync(file, readFileSync(file, 'utf8') + '\nchanged\n');
    expect(() => checkLabFonts({ projectRoot: directory })).toThrow(/source\/asset changed/);
    cpSync(path.join(root, 'src/content/lab/zh/sample-simulation.md'), file);
    const manifestFile = path.join(directory, 'public/fonts/noto-sans-sc-lab-index-manifest.json');
    const manifest = readJson(manifestFile);
    manifest.faces[0].codepoints.push('U+9F98');
    writeFileSync(manifestFile, JSON.stringify(manifest));
    expect(() => checkLabFonts({ projectRoot: directory })).toThrow(/actual cmap/);
  });
});
