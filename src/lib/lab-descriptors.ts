import { validateLabDescriptors } from './lab-page-contract';
const descriptors = import.meta.glob('../components/lab/*/page.json', {
  eager: true,
  import: 'default',
});
export const labDescriptors = validateLabDescriptors(descriptors);
export const installedLabCodes = new Set(labDescriptors.map(({ descriptor }) => descriptor.code));
