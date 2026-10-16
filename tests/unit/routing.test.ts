import { describe, expect, it } from 'vitest';
import {
  localeFromPath,
  normalizeLocalPath,
  otherLocale,
  splitLocalPath,
  stripLocale,
} from '../../src/i18n/routing';

describe('localized navigation paths', () => {
  it('keeps a detail route and its query/hash when removing the language prefix', () => {
    expect(stripLocale('/en/work/sample-case/?view=detail#evidence')).toBe(
      '/work/sample-case/?view=detail#evidence',
    );
    expect(stripLocale('/work/sample-case/')).toBe('/work/sample-case/');
    expect(stripLocale('/zh/lab/sample-simulation')).toBe('/lab/sample-simulation/');
  });

  it('recognizes locale only as a complete leading segment', () => {
    expect(localeFromPath('/en/lab/')).toBe('en');
    expect(localeFromPath('/en')).toBe('en');
    expect(localeFromPath('/engineering/')).toBe('zh');
    expect(localeFromPath('/work/en/')).toBe('zh');
    expect(localeFromPath('/')).toBe('zh');
    expect(otherLocale(otherLocale('en'))).toBe('en');
  });

  it('normalizes relative inputs and is idempotent', () => {
    const normalized = normalizeLocalPath('work//sample-case?source=nav#summary');
    expect(normalized).toBe('/work/sample-case/?source=nav#summary');
    expect(normalizeLocalPath(normalized)).toBe(normalized);
    expect(splitLocalPath('/en/?q=a/b#summary')).toEqual({
      pathname: '/en/',
      suffix: '?q=a/b#summary',
    });
    expect(stripLocale('/en/?q=one')).toBe('/?q=one');
  });

  it.each([
    'https://example.com/work/',
    '//example.com/work/',
    'javascript:alert(1)',
    '/\\example.com',
    '/work/../about',
    '/work/%2e%2e/about',
    '/work/%2fabout',
    '/work/%5cabout',
    '/work/%00',
    '/work/%zz',
  ])('rejects unsafe navigation input %s', (path) => {
    expect(() => normalizeLocalPath(path)).toThrow();
  });
});
