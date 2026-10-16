import { describe, expect, it } from 'vitest';
import {
  assertLocalizedContent,
  localizedEntries,
  type LocalizedOrderedEntry,
} from '../../src/lib/content-utils';

const entry = (
  lang: 'zh' | 'en',
  translationKey: string,
  order: number,
): LocalizedOrderedEntry => ({
  id: `${lang}/${translationKey}`,
  data: { lang, translationKey, order },
});

describe('localized content selection', () => {
  it('filters and sorts deterministically without mutating the collection', () => {
    const source = [
      entry('en', 'last', 9),
      entry('zh', 'zeta', 2),
      entry('zh', 'alpha', 2),
      entry('zh', 'first', 1),
    ];
    const originalIds = source.map((item) => item.id);
    expect(localizedEntries(source, 'zh').map((item) => item.id)).toEqual([
      'zh/first',
      'zh/alpha',
      'zh/zeta',
    ]);
    expect(source.map((item) => item.id)).toEqual(originalIds);
    expect(localizedEntries(source, 'en').map((item) => item.id)).toEqual(['en/last']);
  });

  it('requires one translated counterpart with a matching file path', () => {
    expect(() =>
      assertLocalizedContent([entry('zh', 'case', 1), entry('en', 'case', 1)]),
    ).not.toThrow();
    expect(() => assertLocalizedContent([entry('zh', 'case', 1)])).toThrow(
      'Missing translation: en/case',
    );
    const wrongPath = { ...entry('en', 'case', 1), id: 'en/other' };
    expect(() => assertLocalizedContent([entry('zh', 'case', 1), wrongPath])).toThrow('disagree');
  });

  it('rejects duplicate keys before generating colliding detail routes', () => {
    expect(() =>
      assertLocalizedContent([
        entry('zh', 'case', 1),
        entry('zh', 'case', 2),
        entry('en', 'case', 1),
      ]),
    ).toThrow('Duplicate');
  });
});
