import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const head = event.pull_request?.head?.sha ?? process.env.GITHUB_SHA ?? 'HEAD';
let base = event.pull_request?.base?.sha ?? event.before;
if (event.pull_request) base = git('merge-base', base, head);
let commits;
if (base && !/^0+$/.test(base))
  commits = git('rev-list', '--reverse', `${base}..${head}`).split('\n').filter(Boolean);
else commits = git('rev-list', '--reverse', head).split('\n').filter(Boolean);
for (const commit of commits) {
  const message = git('log', '-1', '--format=%B', commit);
  const result = spawnSync(
    process.execPath,
    [path.resolve('node_modules/@commitlint/cli/cli.js')],
    { input: message, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
  if (result.status !== 0) {
    console.error(
      `Conventional Commits check failed for ${commit.slice(0, 8)}. Run pnpm exec commitlint --from <base> --to <head> locally for details.`,
    );
    process.exit(1);
  }
}
console.log(`Conventional Commits: ${commits.length} commit(s) passed.`);
