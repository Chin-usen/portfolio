import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectText, parseKeywords, privacyText, scan } from '../../scripts/security-scan.mjs';

const temporaryRoots: string[] = [];
const phone = ['139', '0000', '2468'].join('');
const birthday = ['1998', '02', '31'].join('-');

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('privacy scanner rules', () => {
  it('detects a standalone mainland mobile number, including full-width digits', () => {
    expect(inspectText(`phone: ${phone}`)).toEqual([{ rule: 'cn-mobile-number', line: 1 }]);
    const fullWidth = [...phone]
      .map((character) => String.fromCharCode(character.charCodeAt(0) + 0xfee0))
      .join('');
    expect(inspectText(fullWidth)).toHaveLength(1);
    expect(inspectText(`2${phone}4`)).toEqual([]);
    expect(inspectText(`0.${phone}`)).toEqual([]);
    expect(inspectText(`+86 ${phone}`)).toHaveLength(1);
    expect(inspectText(JSON.stringify({ phone }))).toHaveLength(1);
    expect(inspectText(['120', '0000', '2468'].join(''))).toEqual([]);
  });

  it('blocks date-shaped birthday values without blocking normal publication dates', () => {
    for (const key of ['birthday', 'birth_date', 'date of birth', 'dob', '生日', '出生日期']) {
      expect(inspectText(`${key}: ${birthday}`)).toEqual([{ rule: 'birthday-date', line: 1 }]);
    }
    expect(inspectText(`updated: ${birthday}`)).toEqual([]);
    expect(inspectText(`published: ${birthday}\nProject launched.`)).toEqual([]);
    expect(inspectText(`<dt>生日</dt><dd>${birthday}</dd>`)).toHaveLength(1);
  });

  it('treats comma-separated keywords as literal case-insensitive strings', () => {
    const policy = parseKeywords('  Project(A), PROJECT(a), 部门名称, , ');
    expect(policy).toEqual(['project(a)', '部门名称']);
    expect(inspectText('PROJECT(A) and 部门名称', policy)).toEqual([
      { rule: 'blocked-keyword', line: 1 },
      { rule: 'blocked-keyword', line: 1 },
    ]);
    expect(inspectText('ProjectA', policy)).toEqual([]);
    expect(parseKeywords(undefined)).toEqual([]);
  });

  it('never returns matched text or configured values', () => {
    const keyword = ['private', 'project'].join('-');
    const findings = inspectText(`line one\n${keyword}`, parseKeywords(keyword));
    expect(findings).toEqual([{ rule: 'blocked-keyword', line: 2 }]);
    expect(JSON.stringify(findings)).not.toContain(keyword);
  });

  it('does not trigger on its own regex or synthetic test source', async () => {
    for (const file of ['scripts/security-scan.mjs', 'tests/unit/security.test.ts']) {
      expect(inspectText(await readFile(file, 'utf8'))).toEqual([]);
    }
  });

  it('scans source and built HTML but excludes dependency/tool output', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'portfolio-scan-'));
    temporaryRoots.push(root);
    for (const dir of ['src/content', 'dist/en', 'node_modules/demo', 'playwright-report'])
      await mkdir(path.join(root, dir), { recursive: true });
    await writeFile(path.join(root, 'src/content/profile.md'), `phone: ${phone}`);
    await writeFile(path.join(root, 'dist/en/index.html'), `<p>生日: ${birthday}</p>`);
    await writeFile(path.join(root, 'node_modules/demo/index.js'), phone);
    await writeFile(path.join(root, 'playwright-report/index.html'), phone);
    const result = await scan(root);
    expect(result.keywordPolicyEnabled).toBe(false);
    expect(result.fileCount).toBe(2);
    expect(result.findings.map(({ rule }) => rule).sort()).toEqual([
      'birthday-date',
      'cn-mobile-number',
    ]);
    expect(JSON.stringify(result)).not.toContain(phone);
    expect(JSON.stringify(result)).not.toContain(birthday);
  });
});

describe('generated Lighthouse privacy text', () => {
  const filename = 'reports/bold/lighthouse/example.report.json';
  const report = (details: Record<string, unknown>) =>
    JSON.stringify({
      lighthouseVersion: '12.0.0',
      requestedUrl: 'http://localhost/',
      audits: { measurement: { details } },
      categories: { performance: { score: 1 } },
    });

  it('ignores numeric timing telemetry and image encoding only inside a valid report', () => {
    const value = report({
      timestamp: Number(phone),
      screenshot: `data:image/png;base64,${phone}`,
    });
    expect(inspectText(privacyText(value, filename))).toEqual([]);
    expect(
      inspectText(privacyText(value, 'reports/v2/lighthouse/median-reports/home.json')),
    ).toEqual([]);
    expect(inspectText(privacyText(report({ contact: Number(phone) }), filename))).toHaveLength(1);
    expect(inspectText(privacyText(value, 'src/example.report.json'))).toHaveLength(2);
    expect(
      inspectText(privacyText(JSON.stringify({ timestamp: Number(phone) }), filename)),
    ).toHaveLength(1);
  });

  it('retains sensitive strings, labels and configured keywords from diagnostics', () => {
    const value = report({ snippet: `phone: ${phone}`, birthday, warning: 'private-project' });
    expect(
      inspectText(privacyText(value, filename), ['private-project']).map(({ rule }) => rule),
    ).toEqual(['cn-mobile-number', 'birthday-date', 'blocked-keyword']);
  });

  it('keeps HTML outside the report payload and malformed report text scanned', () => {
    const value = report({ timestamp: Number(phone), note: `phone: ${phone}` });
    const html = `<p>${phone}</p><script>window.__LIGHTHOUSE_JSON__ = ${value};</script>`;
    expect(inspectText(privacyText(html, filename.replace('.json', '.html')))).toHaveLength(2);
    const malformed = `<script>window.__LIGHTHOUSE_JSON__ = {bad: ${phone}};</script>`;
    expect(privacyText(malformed, filename.replace('.json', '.html'))).toBe(malformed);
  });
});
