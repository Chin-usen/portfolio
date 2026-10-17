import defaults from './params.json' with { type: 'json' };
import { createOpticalModel, type LensPrescription, type OpticalModel } from './optics.ts';

/** Illustrative prescription shared by the page, the runtime model and the GLB generator. */
export const ACL_DEFAULT_PRESCRIPTION: Readonly<LensPrescription> = Object.freeze(
  structuredClone(defaults) as LensPrescription,
);
/** Stable semantic selection ids, in the teaching order used by tags and descriptions. */
export const ACL_PART_IDS = [
  'lens-barrel',
  'lens-1',
  'lens-2',
  'lens-3',
  'lens-4',
  'lens-5',
  'lens-6',
  'spacers',
  'aperture-stop',
  'ir-cut-filter',
  'retaining-ring',
  'o-ring',
  'lens-holder',
  'image-sensor',
  'pcb',
  'aa-adhesive',
] as const;
export type AclPartId = (typeof ACL_PART_IDS)[number];
export const ACL_LENS_IDS = ['lens-1', 'lens-2', 'lens-3', 'lens-4', 'lens-5', 'lens-6'] as const;
export type AclMode = 'whole' | 'optics';
/** Mechanical and electronic parts hidden by the optical-train view. */
export const ACL_HIDDEN_IN_OPTICS: readonly AclPartId[] = [
  'lens-barrel',
  'spacers',
  'retaining-ring',
  'o-ring',
  'lens-holder',
  'pcb',
  'aa-adhesive',
];
/** Axial explosion order from the object side: lenses leave the barrel through its front. */
export const ACL_EXPLODE_ORDER: readonly string[] = [
  'retaining-ring',
  'o-ring',
  'lens-1',
  'spacer-1',
  'lens-2',
  'spacer-2',
  'lens-3',
  'spacer-3',
  'aperture-stop',
  'spacer-4',
  'lens-4',
  'spacer-5',
  'lens-5',
  'spacer-6',
  'lens-6',
  'lens-barrel',
  'lens-holder',
  'ir-cut-filter',
  'aa-adhesive',
  'image-sensor',
  'pcb',
];
/** Axial display gap between exploded groups, widened after each sub-assembly. */
export const ACL_EXPLODE_GAP_MM = 3;
export const ACL_EXPLODE_MODULE_GAP_MM = 7;
export const ACL_EXPLODE_MODULE_BREAKS: readonly string[] = ['lens-6', 'lens-barrel'];

export function prepareOptics(
  prescription: Readonly<LensPrescription> = ACL_DEFAULT_PRESCRIPTION,
): OpticalModel {
  return createOpticalModel(prescription as LensPrescription);
}
/** Shared reset/poster view direction (world, from target towards camera). */
export const ACL_VIEW_DIRECTION: readonly [number, number, number] = [-0.5, 0.55, 1];
