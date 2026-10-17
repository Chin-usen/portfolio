import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import { labDescriptors } from './lab-descriptors';
const components = import.meta.glob<{ default: AstroComponentFactory }>(
  '../components/lab/*/Page.astro',
  { eager: true },
);
const pages = new Map(
  labDescriptors.map(({ directory, descriptor }) => {
    const component = components[`../components/lab/${directory}/Page.astro`]?.default;
    if (!component) throw Error(`Missing Page.astro for registered lab: ${descriptor.slug}`);
    return [descriptor.slug, { descriptor, component }] as const;
  }),
);
for (const key of Object.keys(components)) {
  if (!labDescriptors.some(({ directory }) => key === `../components/lab/${directory}/Page.astro`))
    throw Error(`Page.astro has no descriptor: ${key}`);
}
export const getLabPage = (slug: string) => pages.get(slug);
