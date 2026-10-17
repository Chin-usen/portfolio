import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import manifest from '../../public/fonts/work-detail/noto-sans-sc-work-detail-manifest.json';
import { notoTitleFontPreloads } from '../../src/lib/critical-font-preloads';
import { inspectWoff2 } from '../../scripts/inspect-woff2.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const workDirectory = path.join(root, 'src/content/work/zh');

describe('critical title font selection', () => {
  it('covers every current work title with real, hash-verified bold font glyphs', () => {
    for (const file of readdirSync(workDirectory).filter((file) => file.endsWith('.md'))) {
      const source = readFileSync(path.join(workDirectory, file), 'utf8');
      const title = source.match(/'title':\s*'([^']+)'/)?.[1];
      expect(title, `title in ${file}`).toBeDefined();
      const preloads = notoTitleFontPreloads(title!);
      const covered = new Set<number>();
      expect(preloads.length).toBeGreaterThan(0);
      expect(new Set(preloads).size).toBe(preloads.length);
      for (const url of preloads) {
        const face = manifest.faces.find((face) => `/fonts/work-detail/${face.file}` === url);
        expect(face).toBeDefined();
        const bytes = readFileSync(path.join(root, 'public', url));
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(face!.sha256.join(''));
        const actual = inspectWoff2(bytes);
        expect(actual.weight).toBe(700);
        for (const code of actual.codes) covered.add(code);
      }
      for (const character of title!) {
        const code = character.codePointAt(0)!;
        if (code > 127) expect(covered.has(code), `${file}: ${character}`).toBe(true);
      }
    }
  });

  it('does not preload CJK fonts for ASCII-only or empty titles', () => {
    expect(notoTitleFontPreloads('Sample case A')).toEqual([]);
    expect(notoTitleFontPreloads('')).toEqual([]);
  });

  it('never manufactures URLs for future text outside the checked subsets', () => {
    expect(notoTitleFontPreloads(String.fromCodePoint(0x10ffff))).toEqual([]);
  });
});
