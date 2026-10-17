import { describe, expect, it } from 'vitest';
import { assertLabPageContent, validateLabDescriptors } from '../../src/lib/lab-page-contract';
const descriptor = {
  contractVersion: 1,
  slug: 'example-reducer',
  code: 'L3',
  template: 'disassembly',
  bodyClass: 'reducer-page',
  fonts: {
    commonNoto: false,
    mono: true,
    preload: { zh: ['/models/example-reducer/fonts/regular.woff2'] },
  },
};
const records = () =>
  validateLabDescriptors({ '../components/lab/example-reducer/page.json': descriptor });
const part = {
  id: 'housing',
  name: 'Housing',
  short: 'Housing',
  role: 'Enclosure',
  features: 'Fixed',
  material: 'Alloy',
  order: 0,
};
const entries = () =>
  ['zh', 'en'].map((lang) => ({
    id: lang + '/example-reducer',
    data: {
      lang: lang as 'zh' | 'en',
      translationKey: 'example-reducer',
      kind: 'teardown' as const,
      parts: [{ ...part }],
    },
  }));
describe('independently installed lab pages', () => {
  it('accepts aligned bilingual Content Collection parts and page-owned fonts', () =>
    expect(() => assertLabPageContent(entries(), records())).not.toThrow());
  it.each([
    { slug: '../escape' },
    { bodyClass: 'bad" onclick=x' },
    { code: 'L03' },
    {
      fonts: {
        commonNoto: false,
        mono: false,
        preload: { zh: ['https://example.com/font.woff2'] },
      },
    },
    { fonts: { commonNoto: false, mono: false, preload: { zh: ['/models/other/font.woff2'] } } },
    {
      fonts: {
        commonNoto: false,
        mono: false,
        preload: { zh: ['/models/example-reducer/../font.woff2'] },
      },
    },
  ])('rejects invalid registry or foreign font metadata %j', (change) => {
    expect(() =>
      validateLabDescriptors({
        '../components/lab/example-reducer/page.json': { ...descriptor, ...change },
      }),
    ).toThrow();
  });
  it('rejects duplicate codes across independently added folders', () =>
    expect(() =>
      validateLabDescriptors({
        '../components/lab/example-reducer/page.json': descriptor,
        '../components/lab/second/page.json': {
          ...descriptor,
          slug: 'second',
          fonts: { commonNoto: true, mono: false },
        },
      }),
    ).toThrow(/Duplicate/));
  it('rejects missing translations', () =>
    expect(() => assertLabPageContent(entries().slice(0, 1), records())).toThrow(/translation/));
  it('rejects divergent part identities between locales', () => {
    const data = entries();
    data[1]!.data.parts[0]!.id = 'rotor';
    expect(() => assertLabPageContent(data, records())).toThrow(/ids\/order/);
  });
  it('rejects duplicate part ids', () => {
    const data = entries();
    data[0]!.data.parts.push({ ...part });
    expect(() => assertLabPageContent(data, records())).toThrow(/Duplicate part/);
  });
  it('rejects an installed disassembly without parts', () => {
    const data = entries();
    data.forEach((entry) => (entry.data.parts = []));
    expect(() => assertLabPageContent(data, records())).toThrow(/parts missing/);
  });
});
