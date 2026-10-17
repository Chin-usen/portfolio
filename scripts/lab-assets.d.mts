export interface LabPipeline {
  slug: string;
  folder: string;
  legacy: boolean;
}
export function discoverLabPipelines(projectRoot?: string): Promise<LabPipeline[]>;
export function runLabAssets(args: string[], projectRoot?: string): Promise<void>;
