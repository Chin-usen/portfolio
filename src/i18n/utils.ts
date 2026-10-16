import { getRelativeLocaleUrl } from 'astro:i18n';
import { splitLocalPath, stripLocale, type Locale } from './routing';
export {
  defaultLocale,
  isLocale,
  localeFromPath,
  locales,
  otherLocale,
  stripLocale,
} from './routing';
export type { Locale } from './routing';

/** Astro owns locale prefixes; the pure helper only validates and strips input. */
export function localePath(locale: Locale, path = '/'): string {
  const { pathname, suffix } = splitLocalPath(stripLocale(path));
  return `${getRelativeLocaleUrl(locale, pathname.slice(1))}${suffix}`;
}
