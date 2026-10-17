import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { labPartSchema } from './lib/lab-page-contract';

const text = z.string().trim().min(1);
const locale = z.enum(['zh', 'en']);
const translationKey = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a stable lowercase slug.');
const localized = { lang: locale, translationKey };
const markdownId = ({ entry }: { entry: string }) => entry.replace(/\\/g, '/').replace(/\.md$/, '');

const work = defineCollection({
  loader: glob({ pattern: '{zh,en}/*.md', base: './src/content/work', generateId: markdownId }),
  schema: z.object({
    ...localized,
    title: text,
    summary: text,
    metrics: z.array(z.object({ label: text, value: text, note: text })).min(1),
    tags: z.array(text).min(1),
    role: text,
    period: text,
    tools: z.array(text).min(1),
    order: z.number().int().nonnegative(),
  }),
});

const lab = defineCollection({
  loader: glob({ pattern: '{zh,en}/*.md', base: './src/content/lab', generateId: markdownId }),
  schema: z.object({
    ...localized,
    title: text,
    kind: z.enum(['teardown', 'simulation']),
    summary: text,
    basis: text,
    status: text,
    parts: z.array(labPartSchema).min(1).optional(),
    order: z.number().int().nonnegative(),
  }),
});

const profile = defineCollection({
  loader: glob({
    pattern: '{zh,en}.yaml',
    base: './src/content/profile',
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ''),
  }),
  schema: z.object({
    lang: locale,
    name: text,
    role: text,
    email: z.object({
      user: z.string().regex(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/),
      domain: z.string().regex(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/),
    }),
    linkedin: z.url().refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        ['linkedin.com', 'www.linkedin.com'].includes(url.hostname) &&
        !url.username &&
        !url.password
      );
    }, 'Use an HTTPS LinkedIn URL.'),
    languages: z.array(text).min(1),
    skills: z.array(text).min(1),
  }),
});

const home = defineCollection({
  loader: glob({
    pattern: '{zh,en}.json',
    base: './src/content/home',
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: z.object({
    lang: locale,
    pageTitle: text,
    description: text,
    name: text,
    navWork: text,
    navLab: text,
    eyebrow: text,
    titleLines: z.array(text).length(2),
    specialties: z.array(text).length(4),
    workCta: text,
    labCta: text,
    modelAlt: text,
    metrics: z.object({
      label: text,
      value: text,
      description: z.array(text).length(2),
      secondary: z.array(z.object({ value: text, label: text })).length(3),
    }),
    lab: z.object({
      title: text,
      kicker: text,
      allLabel: text,
      simulation: z.object({
        label: text,
        title: text,
        subtitle: text,
        description: z.array(text).length(2),
        thicknessLabel: text,
        temperatureLabel: text,
        modelNote: text,
        openLabel: text,
        noJs: text,
      }),
      planned: z
        .array(
          z.object({
            label: text,
            title: text,
            subtitle: text,
            description: text,
            status: text,
          }),
        )
        .length(3),
    }),
    footer: z.object({
      copyright: text,
      contactLabel: text,
      linkedInLabel: text,
      resumeLabel: text,
    }),
  }),
});

const halfBridgeParts = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/halfBridgeParts' }),
  schema: z.object({
    partId: z.enum([
      'housing',
      'dc-terminal',
      'ac-terminal',
      'busbar',
      'signal-pin',
      'gate-wire',
      'mosfet',
      'amb',
      'solder',
      'baseplate',
    ]),
    nameZh: text,
    nameEn: text,
    shortZh: text,
    shortEn: text,
    roleZh: text,
    roleEn: text,
    featuresZh: text,
    featuresEn: text,
    materialZh: text,
    materialEn: text,
    order: z.number().int().nonnegative(),
  }),
});

export const collections = { work, lab, profile, home, halfBridgeParts };
