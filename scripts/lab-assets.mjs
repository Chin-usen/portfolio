import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function discoverLabPipelines(projectRoot = root) {
  const base = path.join(projectRoot, 'src/components/lab');
  const entries = await readdir(base, { withFileTypes: true });
  const found = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const folder = path.join(base, entry.name);
    let descriptor;
    try {
      descriptor = JSON.parse(await readFile(path.join(folder, 'page.json'), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (descriptor.contractVersion !== 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(descriptor.slug))
      throw Error(`Invalid page descriptor: ${entry.name}`);
    if (found.some((page) => page.slug === descriptor.slug))
      throw Error(`Duplicate page slug: ${descriptor.slug}`);
    found.push({
      slug: descriptor.slug,
      folder,
      legacy: descriptor.slug === 'chip-junction-temperature',
    });
  }
  return found;
}
export async function runLabAssets(args, projectRoot = root) {
  const [action, selection, ...rest] = args;
  if (!['generate', 'verify', 'fonts'].includes(action) || !selection)
    throw Error('Usage: lab-assets.mjs generate|verify|fonts <slug|--all> [--evidence <path>]');
  if (selection === '--all' && action === 'generate')
    throw Error('Generate one page explicitly; verify may use --all.');
  const pages = await discoverLabPipelines(projectRoot);
  const selected = selection === '--all' ? pages : pages.filter((page) => page.slug === selection);
  if (!selected.length) throw Error(`Unknown installed lab: ${selection}`);
  for (const page of selected) {
    const hook = path.join(page.folder, 'model', action + '.mjs');
    let actual;
    try {
      actual = await realpath(hook);
    } catch (error) {
      if (error.code === 'ENOENT' && (page.legacy || action === 'fonts')) {
        console.log(
          `${page.slug}: no ${action} hook; existing S1 tests or original font fallback apply.`,
        );
        continue;
      }
      throw error;
    }
    const owned = await realpath(page.folder);
    if (!actual.startsWith(owned + path.sep))
      throw Error(`Page hook escapes its directory: ${page.slug}`);
    const forwarded = [...rest];
    const evidenceIndex = forwarded.indexOf('--evidence');
    if (selection === '--all' && evidenceIndex >= 0) {
      if (!forwarded[evidenceIndex + 1]) throw Error('--evidence needs a path');
      forwarded[evidenceIndex + 1] = path.resolve(forwarded[evidenceIndex + 1], page.slug);
    }
    console.log(`${action}: ${page.slug}`);
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--experimental-strip-types', actual, ...forwarded], {
        cwd: projectRoot,
        stdio: 'inherit',
        windowsHide: true,
      });
      child.once('error', reject);
      child.once('close', resolve);
    });
    if (code !== 0) throw Error(`${page.slug} ${action} failed: ${code}`);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await runLabAssets(process.argv.slice(2));
