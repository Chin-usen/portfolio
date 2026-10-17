import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkWorkFonts } from '../../scripts/check-work-fonts.mjs';
import { collectWorkFontInputs } from '../../scripts/work-font-inputs.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const temporary: string[] = [];
const manifestPath = 'public/fonts/work-detail/noto-sans-sc-work-detail-manifest.json';
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'work-fonts-'));
  temporary.push(directory);
  for (const file of Object.keys(collectWorkFontInputs(root).sourceInputsSha256)) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    cpSync(path.join(root, file), path.join(directory, file));
  }
  cpSync(
    path.join(root, 'public/fonts/work-detail'),
    path.join(directory, 'public/fonts/work-detail'),
    { recursive: true },
  );
  cpSync(
    path.join(root, 'src/styles/work-detail-fonts.css'),
    path.join(directory, 'src/styles/work-detail-fonts.css'),
  );
  return directory;
}

describe('Work detail font provenance and editorial coverage', () => {
  it('verifies the actual four weights and their complete current bilingual inventory', () => {
    const result = checkWorkFonts();
    expect(result.faces).toBe(4);
    expect(result.requestedCodepoints).toBeGreaterThan(0);
    const manifest = JSON.parse(readFileSync(path.join(root, manifestPath), 'utf8'));
    for (const locale of ['zh', 'en']) {
      for (const slug of ['sample-case', 'career-case-b', 'career-case-c'])
        expect(
          Object.hasOwn(manifest.sourceInputsSha256, `src/content/work/${locale}/${slug}.md`),
        ).toBe(true);
    }
  });

  it('rejects edited body copy until its checked subsets are regenerated', () => {
    const projectRoot = fixture();
    const file = path.join(projectRoot, 'src/content/work/zh/sample-case.md');
    writeFileSync(file, readFileSync(file, 'utf8') + String.fromCodePoint(0x9f98));
    expect(() => checkWorkFonts({ projectRoot })).toThrow('inventory changed');
  });

  it('discovers a new nested entry instead of silently omitting its font coverage', () => {
    const projectRoot = fixture();
    const folder = path.join(projectRoot, 'src/content/work/zh/new');
    mkdirSync(folder);
    writeFileSync(path.join(folder, 'case.md'), 'New editorial content');
    expect(() => checkWorkFonts({ projectRoot })).toThrow('inventory changed');
  });

  it('rejects a different real weight even when its replacement file hash is correct', () => {
    const projectRoot = fixture();
    const file = path.join(projectRoot, manifestPath);
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    const regular = manifest.faces.find((face: { weight: number }) => face.weight === 400);
    const bold = manifest.faces.find((face: { weight: number }) => face.weight === 700);
    const bytes = readFileSync(path.join(projectRoot, 'public/fonts/work-detail', bold.file));
    writeFileSync(path.join(projectRoot, 'public/fonts/work-detail', regular.file), bytes);
    regular.bytes = bytes.length;
    regular.sha256 = createHash('sha256').update(bytes).digest('hex').match(/.{8}/g);
    writeFileSync(file, JSON.stringify(manifest));
    expect(() => checkWorkFonts({ projectRoot })).toThrow('actual cmap/weight');
  });
});
