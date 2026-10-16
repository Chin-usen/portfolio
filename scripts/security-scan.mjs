import { execFileSync } from 'node:child_process';
import { readFile, readdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const excludedSegments = new Set([
  '.git',
  'node_modules',
  '.astro',
  'coverage',
  'playwright-report',
  'test-results',
  '.lighthouseci',
]);
const textExtensions = new Set([
  '.astro',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
  '.yaml',
  '.yml',
  '.toml',
  '.html',
  '.css',
  '.scss',
  '.txt',
  '.xml',
  '.svg',
  '.csv',
  '.sh',
  '.py',
]);
const phonePattern = /(?<![\d.])1[3-9]\d{9}(?!\d)/g;
const datePattern = /(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/g;
const birthdayLabel =
  /(?:\b(?:birth(?:day|date|_date|-date|\s+date)?|date[_\s-]*of[_\s-]*birth|dob)\b|生日|出生日期|出生年月)[\s"'=:：-]*$/i;

/** @param {string | undefined} value @returns {string[]} */
export function parseKeywords(value) {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((word) => word.trim().normalize('NFKC').toLocaleLowerCase('en-US'))
        .filter(Boolean),
    ),
  ];
}

/**
 * Return rule names and line numbers only. Never return matching values or text.
 * @param {string} text
 * @param {string[]} keywords
 * @returns {{ rule: string, line: number }[]}
 */
export function inspectText(text, keywords = []) {
  const normalized = text.normalize('NFKC');
  const findings = [];
  const lineAt = (index) => normalized.slice(0, index).split('\n').length;
  for (const match of normalized.matchAll(phonePattern))
    findings.push({ rule: 'cn-mobile-number', line: lineAt(match.index) });
  for (const match of normalized.matchAll(datePattern)) {
    // A date must be attached to a birthday label, not a publication/update date.
    const prefix = normalized.slice(Math.max(0, match.index - 100), match.index);
    const nearbyField = prefix.replace(/<[^>]*>/g, ' ');
    if (birthdayLabel.test(nearbyField))
      findings.push({ rule: 'birthday-date', line: lineAt(match.index) });
  }
  const lower = normalized.toLocaleLowerCase('en-US');
  for (const word of keywords) {
    let cursor = 0;
    while (word && (cursor = lower.indexOf(word, cursor)) !== -1) {
      findings.push({ rule: 'blocked-keyword', line: lineAt(cursor) });
      cursor += word.length;
    }
  }
  return findings;
}

/**
 * Inspect generated Lighthouse text without treating numeric timing telemetry or
 * encoded image bytes as personal text. Scope and schema are both required;
 * malformed reports and every source/dist file retain the ordinary raw scan.
 * @param {string} contents
 * @param {string} filename
 * @returns {string}
 */
export function privacyText(contents, filename) {
  const relative = filename.replaceAll('\\', '/');
  if (!/^reports\/(?:[^/]+\/)*lighthouse\/(?:[^/]+\/)*[^/]+\.(?:json|html)$/.test(relative))
    return contents;
  const assignment = /window\.__LIGHTHOUSE_JSON__\s*=\s*([\s\S]*?);<\/script>/;
  const embedded = relative.endsWith('.html') ? contents.match(assignment) : null;
  if (relative.endsWith('.html') && !embedded) return contents;
  try {
    const report = JSON.parse(embedded ? embedded[1] : contents);
    if (
      !report ||
      typeof report.lighthouseVersion !== 'string' ||
      typeof report.requestedUrl !== 'string' ||
      !report.audits ||
      typeof report.audits !== 'object' ||
      !report.categories ||
      typeof report.categories !== 'object'
    )
      return contents;
    const text = JSON.stringify(report, (_key, value) => {
      if (
        typeof value === 'number' &&
        /^(?:timestamp|networkStartTimeTs|observed[A-Za-z]+Ts)$/.test(_key)
      )
        return null;
      if (
        typeof value === 'string' &&
        /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(value)
      )
        return '[encoded image bytes]';
      return value;
    });
    // HTML outside the known JSON assignment is still inspected unchanged.
    return embedded ? contents.replace(embedded[1], text) : text;
  } catch {
    return contents;
  }
}

/** @param {string} filename */
function eligible(filename) {
  const parts = filename.replaceAll('\\', '/').split('/');
  if (parts.some((part) => excludedSegments.has(part))) return false;
  if (['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'].includes(parts.at(-1))) return false;
  return (
    textExtensions.has(path.extname(filename).toLowerCase()) ||
    parts.at(-1).startsWith('.env') ||
    ['.gitignore', '.prettierignore'].includes(parts.at(-1))
  );
}

/** @param {string} root @param {string} relativeDir @returns {Promise<string[]>} */
async function walk(root, relativeDir = '') {
  const entries = await readdir(path.join(root, relativeDir), { withFileTypes: true }).catch(
    (error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  );
  const result = [];
  for (const entry of entries) {
    if (excludedSegments.has(entry.name) || entry.isSymbolicLink()) continue;
    const relative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(root, relative)));
    else if (entry.isFile() && eligible(relative)) result.push(relative);
  }
  return result;
}

/** Scan tracked files (plus local untracked files) and built dist. @param {string} root */
export async function collectFiles(root) {
  let source;
  try {
    source = execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
      .split('\0')
      .filter(Boolean);
  } catch {
    // A downloaded source ZIP has no .git. It must still be scanned completely.
    source = await walk(root);
  }
  const combined = [...source, ...(await walk(root, 'dist'))];
  const files = [];
  for (const relative of new Set(combined)) {
    if (!eligible(relative)) continue;
    const absolute = path.resolve(root, relative);
    const inside = path.relative(root, absolute);
    if (inside.startsWith('..') || path.isAbsolute(inside)) continue;
    const info = await lstat(absolute).catch(() => null);
    if (info?.isFile() && !info.isSymbolicLink()) files.push(relative);
  }
  return files.sort();
}

/** @param {string} value @param {string[]} keywords */
function safePath(value, keywords) {
  let safe = value
    .normalize('NFKC')
    .replace(phonePattern, '[redacted]')
    .replace(datePattern, '[redacted]');
  for (const word of keywords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    safe = safe.replace(new RegExp(escaped, 'gi'), '[redacted]');
  }
  return safe.replaceAll('\n', '').replaceAll('\r', '');
}

/** @param {string} root @param {string | undefined} keywordValue */
export async function scan(root, keywordValue) {
  const keywords = parseKeywords(keywordValue);
  const files = await collectFiles(root);
  const findings = [];
  for (const file of files) {
    const contents = await readFile(path.resolve(root, file), 'utf8');
    if (contents.includes('\0')) continue;
    for (const finding of inspectText(privacyText(contents, file), keywords))
      findings.push({ file: safePath(file, keywords), ...finding });
  }
  return { fileCount: files.length, keywordPolicyEnabled: keywords.length > 0, findings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.cwd());
  try {
    const result = await scan(root, process.env.BLOCKED_KEYWORDS);
    console.log(
      `Security scan: ${result.fileCount} text files; keyword policy ${result.keywordPolicyEnabled ? 'enabled' : 'NOT CONFIGURED (phone/birthday rules still enforced)'}.`,
    );
    for (const finding of result.findings)
      console.error(`${finding.file}:${finding.line} [${finding.rule}] value withheld`);
    if (result.findings.length) {
      console.error(
        `Security scan failed: ${result.findings.length} finding(s). Matched text and policy values are never printed.`,
      );
      process.exitCode = 1;
    } else console.log('Security scan passed for the enabled rules.');
  } catch {
    console.error(
      'Security scan could not complete. No file contents or policy values were logged.',
    );
    process.exitCode = 2;
  }
}
