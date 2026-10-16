import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const binary = process.env.GITLEAKS_BIN ?? 'gitleaks';
const common = [
  '--config=.gitleaks.toml',
  '--redact=100',
  '--no-banner',
  '--log-level=error',
  '--exit-code=1',
  '--ignore-gitleaks-allow',
];
const historyAvailable = existsSync('.git');
const scopes = historyAvailable
  ? [
      ['git', '--log-opts=--all', ...common],
      ['dir', '.', ...common],
    ]
  : [['dir', '.', ...common]];
if (!historyAvailable)
  console.log('Git history unavailable in this source archive; current files are still scanned.');
if (existsSync('dist')) scopes.push(['dir', 'dist', ...common]);
for (const args of scopes) {
  // Do not expose finding lines, commit messages, tokens, or report files in CI logs.
  const result = spawnSync(binary, args, { stdio: 'ignore' });
  if (result.status !== 0) {
    console.error(
      `Gitleaks ${args[0]} scan failed (finding or tool error). Output withheld. Run gitleaks locally with --redact=100 to investigate.`,
    );
    process.exit(1);
  }
}
console.log('Gitleaks passed for the available scopes. No raw reports were generated.');
