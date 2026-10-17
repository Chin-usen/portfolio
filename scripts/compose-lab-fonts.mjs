import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const read = (root, file) => readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const codes = (text) =>
  new Set([...text].map((char) => char.codePointAt(0)).filter((code) => code > 127));
export const codeLabel = (code) => `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;

function dictionaries(root, keys) {
  const source = read(root, 'src/i18n/dictionaries.ts');
  return keys
    .flatMap((key) =>
      [...source.matchAll(new RegExp(`^  ${key}: \\{(.*?)^  \\},`, 'gms'))].map(
        (match) => match[1],
      ),
    )
    .join('');
}

function scalar(source, key, file) {
  const value = source.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  if (!value || /^[>|]/.test(value))
    throw Error(`Lab font inventory requires scalar ${key}: ${file}`);
  return value;
}

export function collectLabFontInputs(root, pages) {
  let shell = dictionaries(root, ['nav', 'common']);
  for (const locale of ['zh', 'en']) {
    const home = JSON.parse(read(root, `src/content/home/${locale}.json`));
    shell += home.name + home.navWork + home.navLab + JSON.stringify(home.footer);
  }
  for (const name of ['Header', 'Footer']) shell += read(root, `src/components/${name}.astro`);
  let index = shell + dictionaries(root, ['lab']);
  let headings = shell;
  let fallback = shell + dictionaries(root, ['lab', 'demo']);
  const installedCodes = new Set(pages.map(({ page }) => page.code));
  const installedSlugs = new Set(pages.map(({ page }) => page.slug));
  for (const locale of ['zh', 'en']) {
    const home = JSON.parse(read(root, `src/content/home/${locale}.json`)).lab;
    index += home.title + home.kicker + home.allLabel;
    headings += home.title;
    for (const card of home.planned) {
      const code = card.label.match(/^[LS][0-9]+(?=\b|\s|[\u00b7\u2022])/u)?.[0];
      if (!code || !installedCodes.has(code)) {
        index += JSON.stringify(card);
        headings += card.label + card.title;
      }
    }
    for (const name of readdirSync(path.join(root, 'src/content/lab', locale)).sort()) {
      if (!name.endsWith('.md')) continue;
      const file = `src/content/lab/${locale}/${name}`;
      const source = read(root, file);
      const frontmatter = source.split('---', 3)[1];
      if (!frontmatter) throw Error(`Missing lab frontmatter: ${file}`);
      for (const key of ['title', 'summary', 'status', 'kind']) {
        const value = scalar(frontmatter, key, file);
        index += value;
        if (key === 'title') headings += value;
      }
      const slug = scalar(frontmatter, 'translationKey', file).replace(/^['"]|['"]$/g, '');
      if (!installedSlugs.has(slug)) fallback += source;
    }
  }
  for (const name of ['LabIndex', 'LabCard']) {
    const source = read(root, `src/components/${name}.astro`);
    index += source;
    headings += [...source.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gs)]
      .map((match) => match[1])
      .join('');
  }
  for (const name of ['LabDetail', 'DemoPanel'])
    fallback += read(root, `src/components/${name}.astro`);
  for (const name of readdirSync(path.join(root, 'src/scripts')).sort()) {
    if (name.startsWith('demos')) fallback += read(root, `src/scripts/${name}`);
  }
  return { index: { 400: codes(index), 700: codes(headings) }, fallback: codes(fallback) };
}

function faceCss(family, face, selected) {
  return `@font-face {\n  font-family: '${family}';\n  font-style: normal;\n  font-display: optional;\n  font-weight: ${face.weight};\n  src: url('${face.url}') format('woff2');\n  unicode-range: ${[
    ...selected,
  ]
    .sort((a, b) => a - b)
    .map(codeLabel)
    .join(',')};\n}`;
}

// Inputs have already passed source/asset/license hashes, real cmap and OS/2 weight checks.
export function composeLabIndexFonts(baseFaces, pageFaces, requested) {
  const family = 'Noto Sans SC Lab Index';
  const fallbackFamily = `${family} Regular Fallback`;
  const output = [];
  const selections = [];
  const ordered = [...baseFaces, ...pageFaces.filter((face) => [400, 700].includes(face.weight))];
  for (const weight of [400, 700]) {
    const remaining = new Set(requested[weight]);
    const groups = [
      baseFaces.filter((face) => face.weight === weight),
      ordered.filter((face) => !baseFaces.includes(face) && face.weight === weight),
    ];
    if (weight === 700) {
      groups.push(baseFaces.filter((face) => face.weight === 400));
      groups.push(ordered.filter((face) => !baseFaces.includes(face) && face.weight === 400));
    }
    for (const group of groups) {
      const pending = [...group];
      while (pending.length && remaining.size) {
        // Prefer the face covering most missing glyphs; avoid loading several
        // unrelated page fonts when one newly installed page already owns them.
        pending.sort((a, b) => {
          const count = (face) => [...remaining].filter((code) => face.codes.has(code)).length;
          return count(b) - count(a) || a.bytes - b.bytes || a.url.localeCompare(b.url, 'en');
        });
        const face = pending.shift();
        const selected = new Set([...remaining].filter((code) => face.codes.has(code)));
        if (!selected.size) break;
        const regularFallback = weight === 700 && face.weight === 400;
        output.push(faceCss(regularFallback ? fallbackFamily : family, face, selected));
        selections.push({
          url: face.url,
          requestedWeight: weight,
          weight: face.weight,
          codepoints: [...selected].sort((a, b) => a - b),
          regularFallback,
        });
        for (const code of selected) remaining.delete(code);
      }
    }
    if (remaining.size)
      throw Error(
        `Lab index ${weight} has no verified subset for ${[...remaining]
          .sort((a, b) => a - b)
          .map(codeLabel)
          .join(', ')}. Regenerate the owning page fonts.`,
      );
  }
  output.push(
    `body.lab-index-page {\n  --thermal-font: 'Geist Variable', '${family}', '${fallbackFamily}', -apple-system, BlinkMacSystemFont, sans-serif;\n  font-family: var(--thermal-font);\n  font-synthesis: none;\n}`,
  );
  return {
    css:
      '/* Build output: verified base subsets plus disjoint page-owned ranges. */\n' +
      output.join('\n') +
      '\n',
    selections,
  };
}
