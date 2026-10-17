/** Use a mathematical minus for displayed values; keep numeric state unchanged. */
export function formatDisplayNumber(value: number, fractionDigits?: number): string {
  const text = fractionDigits === undefined ? String(value) : value.toFixed(fractionDigits);
  return text.replace(/^-/, '−');
}
