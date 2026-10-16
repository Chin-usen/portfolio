/** Pure routing helpers: deliberately independent of Astro virtual modules. */
export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh';

export function isLocale(value: string): value is Locale {
  return value === 'zh' || value === 'en';
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  );
}

/** Accept only internal paths so language links cannot become external redirects. */
export function normalizeLocalPath(input: string): string {
  const value = input.trim();
  if (
    /^[a-z][a-z\d+.-]*:/i.test(value) ||
    value.startsWith('//') ||
    value.includes('\\') ||
    hasControlCharacter(value)
  ) {
    throw new Error('Expected an internal path.');
  }
  const suffixIndex = value.search(/[?#]/);
  const pathname = suffixIndex < 0 ? value : value.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? '' : value.slice(suffixIndex);
  const segments = pathname.split('/').filter(Boolean);
  for (const segment of segments) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw new Error('Malformed path encoding.');
    }
    if (
      decoded === '.' ||
      decoded === '..' ||
      /[\\/]/.test(decoded) ||
      hasControlCharacter(decoded)
    ) {
      throw new Error('Unsafe path segment.');
    }
  }
  const normalized = `/${segments.join('/')}`;
  return `${normalized === '/' ? '/' : `${normalized}/`}${suffix}`;
}

export function splitLocalPath(input: string): { pathname: string; suffix: string } {
  const path = normalizeLocalPath(input);
  const boundary = path.search(/[?#]/);
  return boundary < 0
    ? { pathname: path, suffix: '' }
    : { pathname: path.slice(0, boundary), suffix: path.slice(boundary) };
}

export function localeFromPath(input: string): Locale {
  const { pathname } = splitLocalPath(input);
  return pathname.split('/')[1] === 'en' ? 'en' : defaultLocale;
}

export function stripLocale(input: string): string {
  const { pathname, suffix } = splitLocalPath(input);
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] && isLocale(parts[0])) parts.shift();
  return `${parts.length ? `/${parts.join('/')}/` : '/'}${suffix}`;
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'zh' ? 'en' : 'zh';
}
