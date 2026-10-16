export interface Finding {
  rule: string;
  line: number;
}
export function parseKeywords(value: string | undefined): string[];
export function inspectText(text: string, keywords?: string[]): Finding[];
export function privacyText(contents: string, filename: string): string;
export function collectFiles(root: string): Promise<string[]>;
export function scan(
  root: string,
  keywordValue?: string,
): Promise<{
  fileCount: number;
  keywordPolicyEnabled: boolean;
  findings: (Finding & { file: string })[];
}>;
