import type { DistanceUnit, Vehicle, VehicleBudget } from '@/types';
import {
  compareMonthSpend,
  directionOf,
  getMonthStats,
  getRollingSpendAverage,
  percentChange,
  type FuelAnalysis,
  type MonthStats,
  type RollingSpendAverage,
  type SpendComparison,
  type Trend,
} from './fuelAnalytics';
import { calculateBudgetStatus, type BudgetStatus } from './fuelBudget';
import { forecastMonthSpend, type SpendForecast } from './fuelForecast';
import {
  formatCurrency,
  formatDate,
  formatDistance,
  formatLitres,
  formatMileage,
  formatPercent,
} from './format';
import type { Insight } from './fuelInsights';
import { addMonths, compareMonths, formatMonthLabel, isSameMonth, monthRefOf, type MonthRef } from './period';

/**
 * The monthly report model.
 *
 * Reports are derived, never stored: the source of truth stays the fill-up
 * rows, so editing or deleting one changes every report that mentions it.
 * Everything in `actual` happened; `forecast` is the only projected figure and
 * is carried separately so the UI can never mix the two up.
 */

export interface ReportComparison extends Trend {
  current: number;
  previous: number;
}

export interface MonthlyReport {
  ref: MonthRef;
  /** e.g. "September 2026". */
  label: string;
  previousLabel: string;
  isCurrentMonth: boolean;
  /** True once the month has ended -- past months are final, this one is not. */
  isComplete: boolean;
  /** Everything measured from logged fill-ups. */
  actual: {
    spend: number;
    litres: number;
    fillCount: number;
    fullTankCount: number;
    partialCount: number;
    /** Odometer distance closed by this month's fill-ups. */
    distance: number;
    averageMileage: number | null;
    costPerDistance: number | null;
    observationCount: number;
    /** The month's most recent fill-up date, oldest->newest last entry. Null when the month has none. */
    lastFillupDate: number | null;
  };
  spendComparison: SpendComparison | null;
  mileageComparison: ReportComparison | null;
  distanceComparison: ReportComparison | null;
  rollingSpend: RollingSpendAverage | null;
  /** Only ever set for the month in progress -- see buildMonthlyReport. */
  budget: BudgetStatus | null;
  forecast: SpendForecast | null;
  /** One short observation: the live insight for this month, or a factual recap of a past one. */
  notable: string | null;
  /** What the month can't show yet, and what would unlock it. */
  dataNotes: string[];
}

export interface MonthlyReportOptions {
  /** Which month to report on. Defaults to the analysis's reference month. */
  ref?: MonthRef;
  /** The vehicle's configured budget, if any. */
  budget?: VehicleBudget | null;
  /** The top live insight, supplied by the caller for the current month only. */
  insight?: Insight | null;
  /**
   * False when the user has switched the derived surfaces off in Settings.
   * The budget stays either way -- they configured that one deliberately.
   */
  includeForecast?: boolean;
}

function comparisonOf(current: number | null, previous: number | null): ReportComparison | null {
  if (current === null || previous === null) return null;
  const change = percentChange(current, previous);
  if (change === null) return null;
  return {
    direction: directionOf(change),
    percent: Math.abs(change),
    current,
    previous,
  };
}

/** A factual one-liner for a month that has already ended. */
function recapOf(
  label: string,
  spend: SpendComparison | null,
  mileage: ReportComparison | null
): string | null {
  const parts: string[] = [];
  if (mileage && mileage.direction !== 'flat' && mileage.percent >= 5) {
    parts.push(
      `mileage ${mileage.direction === 'up' ? 'improved' : 'dropped'} ${formatPercent(mileage.percent)}`
    );
  }
  if (spend && spend.direction !== 'flat' && spend.percent >= 10) {
    parts.push(`spending was ${formatPercent(spend.percent)} ${spend.direction === 'up' ? 'higher' : 'lower'}`);
  }
  if (parts.length === 0) return null;
  return `Against ${label}, ${parts.join(' and ')}.`;
}

function buildDataNotes(month: MonthStats, isCurrentMonth: boolean): string[] {
  const notes: string[] = [];
  if (month.fillCount === 0) {
    notes.push(
      isCurrentMonth
        ? 'No fill-ups logged this month yet.'
        : 'No fill-ups were logged in this month.'
    );
    return notes;
  }
  if (month.observations.length === 0) {
    notes.push(
      'Mileage for this month needs two full-tank fill-ups in a row — partial fills still count towards spending and litres.'
    );
  }
  if (month.distance === 0) {
    notes.push('Distance appears once a fill-up follows an earlier one on the same vehicle.');
  }
  if (month.partialCount > 0 && month.observations.length > 0) {
    notes.push(
      `${month.partialCount} partial fill-${month.partialCount === 1 ? 'up is' : 'ups are'} included in spending and litres, but not in mileage.`
    );
  }
  return notes;
}

export function buildMonthlyReport(
  analysis: FuelAnalysis,
  options: MonthlyReportOptions = {}
): MonthlyReport {
  const referenceDate = new Date(analysis.referenceDate);
  const referenceRef = monthRefOf(referenceDate);
  const ref = options.ref ?? referenceRef;
  const isCurrentMonth = isSameMonth(ref, referenceRef);
  const isComplete = compareMonths(ref, referenceRef) < 0;

  const month = getMonthStats(analysis, ref);
  const previousRef = addMonths(ref, -1);
  const previous = getMonthStats(analysis, previousRef);

  const spendComparison = compareMonthSpend(analysis, ref);
  const mileageComparison = comparisonOf(month.averageMileage, previous.averageMileage);
  const distanceComparison = comparisonOf(
    month.distance > 0 ? month.distance : null,
    previous.distance > 0 ? previous.distance : null
  );

  // A budget is a single current figure, not a per-month record, so it is only
  // applied to the month in progress. Measuring an old month against a budget
  // the user may have set last week would invent a history that never existed.
  const budget = isCurrentMonth
    ? calculateBudgetStatus(month.spend, options.budget ?? null)
    : null;

  return {
    ref,
    label: formatMonthLabel(ref),
    previousLabel: formatMonthLabel(previousRef),
    isCurrentMonth,
    isComplete,
    actual: {
      spend: month.spend,
      litres: month.litres,
      fillCount: month.fillCount,
      fullTankCount: month.fullTankCount,
      partialCount: month.partialCount,
      distance: month.distance,
      averageMileage: month.averageMileage,
      costPerDistance: month.costPerDistance,
      observationCount: month.observations.length,
      lastFillupDate: month.entries.length > 0 ? month.entries[month.entries.length - 1].date : null,
    },
    spendComparison,
    mileageComparison,
    distanceComparison,
    rollingSpend: getRollingSpendAverage(analysis, ref),
    budget,
    forecast: isCurrentMonth && options.includeForecast !== false ? forecastMonthSpend(analysis) : null,
    notable: isCurrentMonth
      ? (options.insight?.description ?? null)
      : recapOf(formatMonthLabel(previousRef), spendComparison, mileageComparison),
    dataNotes: buildDataNotes(month, isCurrentMonth),
  };
}

export interface ShareTextSettings {
  currencySymbol: string;
  distanceUnit: DistanceUnit;
}

function arrow(direction: Trend['direction']): string {
  if (direction === 'up') return '↑';
  if (direction === 'down') return '↓';
  return '→';
}

/**
 * The plain-text summary handed to the system share sheet. Text only, on
 * purpose: it pastes into any app, needs no rendering or file writing, and
 * can't leak anything the user didn't choose to send.
 */
export function buildMonthlyReportShareText(
  report: MonthlyReport,
  vehicle: Vehicle,
  settings: ShareTextSettings
): string {
  const { currencySymbol, distanceUnit } = settings;
  const lines: string[] = [`⛽ ${vehicle.name} — ${report.label}`, ''];

  if (report.actual.fillCount === 0) {
    lines.push(
      report.isCurrentMonth
        ? 'No fill-ups logged yet this month.'
        : 'No fill-ups were logged in this month.'
    );
    return lines.join('\n');
  }

  lines.push(`Spent: ${formatCurrency(report.actual.spend, currencySymbol)}`);
  lines.push(`Fuel: ${formatLitres(report.actual.litres)}`);
  if (report.actual.distance > 0) {
    lines.push(`Distance: ${formatDistance(report.actual.distance, distanceUnit)}`);
  }
  if (report.actual.averageMileage !== null) {
    lines.push(`Average mileage: ${formatMileage(report.actual.averageMileage, distanceUnit)}`);
  }
  if (report.actual.costPerDistance !== null) {
    lines.push(
      `Cost per ${distanceUnit}: ${formatCurrency(report.actual.costPerDistance, currencySymbol)}`
    );
  }
  lines.push(
    `Fill-ups: ${report.actual.fillCount} (${report.actual.fullTankCount} full ${report.actual.fullTankCount === 1 ? 'tank' : 'tanks'})`
  );
  if (report.actual.lastFillupDate !== null) {
    lines.push(`Last fill-up: ${formatDate(report.actual.lastFillupDate)}`);
  }

  if (report.spendComparison || report.mileageComparison) {
    lines.push('');
    lines.push(
      report.spendComparison?.basis === 'month-to-date'
        ? `vs ${report.previousLabel} (same days)`
        : `vs ${report.previousLabel}`
    );
    if (report.spendComparison) {
      lines.push(
        `Spending: ${arrow(report.spendComparison.direction)} ${formatPercent(report.spendComparison.percent)}`
      );
    }
    if (report.mileageComparison) {
      lines.push(
        `Mileage: ${arrow(report.mileageComparison.direction)} ${formatPercent(report.mileageComparison.percent)}`
      );
    }
  }

  if (report.budget) {
    lines.push('');
    lines.push(
      `Budget: ${formatCurrency(report.budget.spent, currencySymbol)} of ${formatCurrency(report.budget.amount, currencySymbol)} (${formatPercent(report.budget.percentUsed)} used)`
    );
  }

  if (report.forecast) {
    lines.push('');
    lines.push(
      `Estimated month-end: ${formatCurrency(report.forecast.projected, currencySymbol)} (estimate, not final)`
    );
  }

  lines.push('');
  lines.push('Shared from Tankful');
  return lines.join('\n');
}

/** Months that can be opened in the report: every month with data, plus the current one. */
export function getReportableMonths(analysis: FuelAnalysis): MonthRef[] {
  const referenceRef = monthRefOf(analysis.referenceDate);
  const refs = analysis.months
    .filter((month) => month.fillCount > 0)
    .map((month) => month.ref)
    .filter((ref) => compareMonths(ref, referenceRef) < 0);
  return [...refs, referenceRef];
}
