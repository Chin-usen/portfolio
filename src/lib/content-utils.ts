import type { Locale } from '../i18n/routing';

export interface LocalizedOrderedEntry {
  id: string;
  data: { lang: Locale; translationKey: string; order: number };
}

/** Copy before sorting, and use a stable slug tie-breaker across build machines. */
export function localizedEntries<T extends LocalizedOrderedEntry>(
  entries: readonly T[],
  locale: Locale,
): T[] {
  return entries
    .filter((entry) => entry.data.lang === locale)
    .sort((a, b) => {
      const order = a.data.order - b.data.order;
      if (order) return order;
      return a.data.translationKey < b.data.translationKey
        ? -1
        : a.data.translationKey > b.data.translationKey
          ? 1
          : 0;
    });
}

/** Fail at build time rather than silently publishing mismatched translation URLs. */
export function assertLocalizedContent(entries: readonly LocalizedOrderedEntry[]): void {
  const keys = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.data.lang}/${entry.data.translationKey}`;
    if (entry.id !== key)
      throw new Error(`Content path and locale/translationKey disagree: ${entry.id}`);
    if (keys.has(key)) throw new Error(`Duplicate localized content: ${key}`);
    keys.add(key);
  }
  for (const entry of entries) {
    const counterpart = `${entry.data.lang === 'zh' ? 'en' : 'zh'}/${entry.data.translationKey}`;
    if (!keys.has(counterpart)) throw new Error(`Missing translation: ${counterpart}`);
  }
}
