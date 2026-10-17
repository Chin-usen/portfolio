import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n/routing';
import { labDescriptors } from './lab-descriptors';
import { assertLabPageContent } from './lab-page-contract';
import { assertLocalizedContent, localizedEntries } from './content-utils';

export type WorkEntry = CollectionEntry<'work'>;
export type LabEntry = CollectionEntry<'lab'>;
export type Profile = CollectionEntry<'profile'>['data'];

export async function getLocalizedWork(locale: Locale): Promise<WorkEntry[]> {
  const entries = await getCollection('work');
  assertLocalizedContent(entries);
  return localizedEntries(entries, locale);
}

export async function getLocalizedLab(locale: Locale): Promise<LabEntry[]> {
  const entries = await getCollection('lab');
  assertLocalizedContent(entries);
  assertLabPageContent(entries, labDescriptors);
  return localizedEntries(entries, locale);
}

export async function getProfile(locale: Locale): Promise<Profile> {
  const entries = await getCollection('profile');
  const matches = entries.filter((entry) => entry.data.lang === locale);
  const match = matches[0];
  if (matches.length !== 1 || !match || match.id !== locale) {
    throw new Error(`Expected exactly one profile at src/content/profile/${locale}.yaml`);
  }
  return match.data;
}
