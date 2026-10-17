import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discoverLabPipelines, runLabAssets } from '../../scripts/lab-assets.mjs';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture(slug = 'probe-page') {
  const root = await mkdtemp(path.join(tmpdir(), 'lab-pipeline-'));
  roots.push(root);
  const folder = path.join(root, 'src/components/lab', slug);
  await mkdir(path.join(folder, 'model'), { recursive: true });
  await writeFile(path.join(folder, 'page.json'), JSON.stringify({ contractVersion: 1, slug }));
  return { root, folder };
}
describe('page-owned asset hooks', () => {
  it('discovers each page without a shared registry edit', async () => {
    const { root } = await fixture();
    expect((await discoverLabPipelines(root)).map((page) => page.slug)).toEqual(['probe-page']);
  });
  it('runs the actual isolated hook and forwards evidence arguments', async () => {
    const { root, folder } = await fixture();
    await writeFile(
      path.join(folder, 'model/verify.mjs'),
      "import {writeFileSync} from 'node:fs';writeFileSync('observed.json',JSON.stringify(process.argv.slice(2)));\n",
    );
    await runLabAssets(['verify', '--all', '--evidence', 'evidence'], root);
    const args = JSON.parse(await readFile(path.join(root, 'observed.json'), 'utf8'));
    expect(args).toEqual(['--evidence', path.resolve('evidence', 'probe-page')]);
  });
  it('does not silently skip a new page missing verification', async () => {
    const { root } = await fixture();
    await expect(runLabAssets(['verify', '--all'], root)).rejects.toThrow();
  });
  it('propagates failure from a real page verifier', async () => {
    const { root, folder } = await fixture();
    await writeFile(path.join(folder, 'model/verify.mjs'), 'process.exitCode=7;');
    await expect(runLabAssets(['verify', 'probe-page'], root)).rejects.toThrow(/failed: 7/);
  });
  it('rejects accidental regeneration of all pages', async () => {
    const { root } = await fixture();
    await expect(runLabAssets(['generate', '--all'], root)).rejects.toThrow(/one page/);
  });
});
