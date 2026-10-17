import manifest from '../../public/fonts/work-detail/noto-sans-sc-work-detail-manifest.json';

/** Prioritize only the existing bold faces used by the visible title. */
export function notoTitleFontPreloads(title: string): string[] {
  const codes = new Set(Array.from(title, (character) => character.codePointAt(0)));
  // check-work-fonts validates source, actual glyphs/weights and hashes during each build.
  // The build guard requires current content coverage; never guess an asset URL.
  return manifest.faces
    .filter(
      (face) =>
        face.weight === 700 &&
        face.style === 'normal' &&
        face.codepoints.some((code) => codes.has(parseInt(code.slice(2), 16))),
    )
    .map((face) => `/fonts/work-detail/${face.file}`);
}
