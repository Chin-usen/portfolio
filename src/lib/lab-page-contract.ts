import { z } from 'astro/zod';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const fontUrl = z.string().regex(/^\/(?:fonts|models)\/[a-zA-Z0-9/_-]+\.woff2$/);
export const labPartSchema = z.object({
  id: slug,
  name: z.string().trim().min(1),
  secondaryName: z.string().trim().min(1).optional(),
  short: z.string().trim().min(1),
  role: z.string().trim().min(1),
  features: z.string().trim().min(1),
  material: z.string().trim().min(1),
  order: z.number().int().nonnegative(),
});
const descriptorSchema = z
  .object({
    contractVersion: z.literal(1),
    slug,
    code: z.string().regex(/^[LS][1-9][0-9]*$/),
    template: z.enum(['disassembly', 'simulation']),
    bodyClass: z.string().regex(/^[a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)*$/),
    fonts: z
      .object({
        commonNoto: z.boolean(),
        mono: z.boolean(),
        preload: z
          .object({ zh: z.array(fontUrl).optional(), en: z.array(fontUrl).optional() })
          .optional(),
      })
      .strict(),
  })
  .strict();
export type LabPart = z.infer<typeof labPartSchema>;
export type LabPageDescriptor = z.infer<typeof descriptorSchema>;
export type LabFontPolicy = LabPageDescriptor['fonts'];
export type LabDescriptorRecord = { directory: string; descriptor: LabPageDescriptor };

export function validateLabDescriptors(input: Record<string, unknown>): LabDescriptorRecord[] {
  const slugs = new Set<string>();
  const codes = new Set<string>();
  return Object.entries(input)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, value]) => {
      const descriptor = descriptorSchema.parse(value);
      if (slugs.has(descriptor.slug) || codes.has(descriptor.code))
        throw Error(`Duplicate lab slug/code: ${descriptor.slug}/${descriptor.code}`);
      slugs.add(descriptor.slug);
      codes.add(descriptor.code);
      const match = file.match(/\/([^/]+)\/page\.json$/);
      if (!match || match[1]?.startsWith('_')) throw Error(`Invalid lab descriptor path: ${file}`);
      const directory = match[1]!;
      const legacy = {
        'half-bridge': 'half-bridge-module',
        'thermal-stack': 'chip-junction-temperature',
      } as Record<string, string>;
      if ((legacy[directory] ?? directory) !== descriptor.slug)
        throw Error(`Lab directory and slug differ: ${file}`);
      for (const url of [
        ...(descriptor.fonts.preload?.zh ?? []),
        ...(descriptor.fonts.preload?.en ?? []),
      ]) {
        if (url.startsWith('/models/') && !url.startsWith(`/models/${descriptor.slug}/`))
          throw Error(`Font is outside this page: ${url}`);
      }
      return { directory, descriptor };
    });
}

type ContentRecord = {
  id: string;
  data: {
    lang: 'zh' | 'en';
    translationKey: string;
    kind: 'teardown' | 'simulation';
    parts?: LabPart[];
  };
};
export function assertLabPageContent(
  entries: readonly ContentRecord[],
  records: readonly LabDescriptorRecord[],
): void {
  for (const { descriptor } of records) {
    const pair = ['zh', 'en'].map((lang) =>
      entries.find(
        (entry) => entry.data.lang === lang && entry.data.translationKey === descriptor.slug,
      ),
    );
    if (pair.some((entry) => !entry))
      throw Error(`Missing registered lab translation: ${descriptor.slug}`);
    for (const entry of pair) {
      if (!entry) continue;
      if (entry.data.kind !== (descriptor.template === 'disassembly' ? 'teardown' : 'simulation'))
        throw Error(`Lab template/content kind differ: ${entry.id}`);
      const parts = entry.data.parts;
      if (
        descriptor.template === 'disassembly' &&
        descriptor.slug !== 'half-bridge-module' &&
        !parts?.length
      )
        throw Error(`Disassembly parts missing: ${entry.id}`);
      if (parts && new Set(parts.map((part) => part.id)).size !== parts.length)
        throw Error(`Duplicate part id: ${entry.id}`);
    }
    const ids = (entry: ContentRecord | undefined) =>
      entry?.data.parts
        ?.slice()
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((part) => `${part.id}:${part.order}`) ?? [];
    if (JSON.stringify(ids(pair[0])) !== JSON.stringify(ids(pair[1])))
      throw Error(`Localized part ids/order differ: ${descriptor.slug}`);
  }
}
