import { formatDisplayNumber } from '../_shared/format-number';
import { formatSignificant } from './chart';
import type { PinFinResult, ValidityCheck } from './evaluator';

/** Thousands separated by commas; values are always positive in this page. */
export function grouped(value: number, digits = 0): string {
  const [whole, fraction] = value.toFixed(digits).split('.');
  return whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
}

const superscript = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** 2e6 → 2×10⁶ for limits; small numbers stay plain. */
export function formatLimit(value: number): string {
  if (value >= 1e4) {
    const exponent = Math.floor(Math.log10(value));
    const mantissa = Number((value / Math.pow(10, exponent)).toFixed(2));
    const power = String(exponent)
      .split('')
      .map((digit) => superscript[Number(digit)])
      .join('');
    return `${mantissa === 1 ? '' : `${mantissa}×`}10${power}`;
  }
  return Number(value.toPrecision(3)).toString();
}

export function formatRange(check: Pick<ValidityCheck, 'min' | 'max'>): string {
  if (check.min !== null && check.max !== null)
    return `${formatLimit(check.min)} – ${formatLimit(check.max)}`;
  if (check.min !== null) return `≥ ${formatLimit(check.min)}`;
  if (check.max !== null) return `≤ ${formatLimit(check.max)}`;
  return '—';
}

export function formatCheckValue(check: ValidityCheck): string {
  if (check.id.startsWith('prop-')) return `${check.value.toFixed(1)} °C`;
  if (check.id === 'zk-band' || check.id.endsWith('-re')) return grouped(check.value);
  if (check.id === 'zk-rows' || check.id === 'gg-rows') return String(Math.round(check.value));
  return formatSignificant(check.value, 3);
}

export function headline(result: PinFinResult) {
  return {
    rth: formatSignificant(result.rth, 3),
    dp: formatDisplayNumber(result.pressureDropKpa, result.pressureDropKpa < 10 ? 2 : 1),
    h: grouped(result.h),
    re: grouped(result.reynolds),
    pumping: formatSignificant(result.pumpingPower, 3),
    tBase: result.tBase.toFixed(1),
  };
}

export function details(result: PinFinResult): Record<string, string> {
  const layout = result.layout;
  const perRow =
    layout.perRow === layout.perOffsetRow
      ? String(layout.perRow)
      : `${layout.perRow}/${layout.perOffsetRow}`;
  return {
    pins: String(layout.count),
    rows: `${layout.rows} × ${perRow}`,
    area: `${grouped(result.areas.fins * 1e6)} + ${grouped(result.areas.base * 1e6)} mm²`,
    vMax: `${result.velocity.max.toFixed(2)} m/s`,
    nu: result.nusselt.toFixed(1),
    c1c2: `${result.c1.toFixed(3)} · ${result.c2.toFixed(3)}`,
    finEfficiency: result.fin.efficiency.toFixed(3),
    surfaceEfficiency: result.surfaceEfficiency.toFixed(3),
    ntu: `${result.ntu.toFixed(2)} · ${result.effectiveness.toFixed(3)}`,
    rConv: `${formatSignificant(result.rConvective, 3)} K/W`,
    rCaloric: `${formatSignificant(result.rCaloric, 3)} K/W`,
    tOut: `${result.tOut.toFixed(2)} °C`,
    xi: `${result.gaddis.xi.toFixed(3)} · ${result.gaddis.resistances}`,
    props: `${result.bulk.density.toFixed(0)} · ${result.bulk.cp.toFixed(0)} · ${result.bulk.conductivity.toFixed(3)} · ${(result.bulk.viscosity * 1e3).toFixed(3)} mPa·s · ${result.bulk.prandtl.toFixed(2)}`,
  };
}
