import type { FuelAnalysis, MileageObservation } from './fuelAnalytics';

/**
 * "Is the newest mileage result out of line with this vehicle's normal?"
 *
 * Kept separate from the mileage calculation itself (utils/mileage) and from
 * the sustained recent-vs-earlier trend (fuelAnalytics.mileageTrend): those
 * answer what the mileage *was* and where it is *drifting*; this one asks
 * whether the single latest result stands out enough to be worth mentioning.
 *
 * Two conditions have to hold together, which is what keeps it from crying
 * wolf on a vehicle whose mileage naturally swings:
 *
 *   1. it differs from the recent baseline by at least DEVIATION_PERCENT, and
 *   2. the difference is larger than SPREAD_MULTIPLE x the baseline's own
 *      typical swing (mean absolute deviation).
 *
 * A vehicle that regularly bounces 17-21 km/l has a wide spread and needs a
 * bigger jump before anything is said; a vehicle that sits at 17.8 every time
 * gets flagged sooner. No single result on its own can trigger this without a
 * baseline of MIN_BASELINE_OBSERVATIONS behind it.
 */

export interface MileageAnomaly {
  direction: 'below' | 'above';
  /** The observation being judged. */
  observation: MileageObservation;
  latest: number;
  baseline: number;
  /** Absolute percentage difference from the baseline. */
  percent: number;
  /** How many observations formed the baseline. */
  sampleSize: number;
}

/** Prior observations needed before the newest one can be called unusual. */
export const MIN_BASELINE_OBSERVATIONS = 3;

/** Prior observations used, at most -- older tanks describe an older vehicle. */
export const BASELINE_WINDOW = 6;

/** Below this, it is the same tank of fuel behaving slightly differently. */
export const DEVIATION_PERCENT = 15;

/** Multiple of the baseline's own mean absolute deviation the gap must clear. */
export const SPREAD_MULTIPLE = 1.5;

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Mean absolute deviation: a plain, robust "how much does this usually move". */
function meanAbsoluteDeviation(values: number[], centre: number): number {
  return mean(values.map((value) => Math.abs(value - centre)));
}

/** Null when there isn't enough history to judge, or the latest result is normal. */
export function detectMileageAnomaly(analysis: FuelAnalysis): MileageAnomaly | null {
  const observations = analysis.observations;
  if (observations.length < MIN_BASELINE_OBSERVATIONS + 1) return null;

  const latest = observations[observations.length - 1];
  const baselineValues = observations
    .slice(0, -1)
    .slice(-BASELINE_WINDOW)
    .map((observation) => observation.mileage);

  if (baselineValues.length < MIN_BASELINE_OBSERVATIONS) return null;

  const baseline = mean(baselineValues);
  if (!Number.isFinite(baseline) || baseline <= 0) return null;

  const difference = latest.mileage - baseline;
  const percent = (Math.abs(difference) / baseline) * 100;
  if (percent < DEVIATION_PERCENT) return null;

  const spread = meanAbsoluteDeviation(baselineValues, baseline);
  if (Math.abs(difference) <= SPREAD_MULTIPLE * spread) return null;

  return {
    direction: difference < 0 ? 'below' : 'above',
    observation: latest,
    latest: latest.mileage,
    baseline,
    percent,
    sampleSize: baselineValues.length,
  };
}

/**
 * Things that plausibly move fuel efficiency, in the order a driver can check
 * them. Presented as possibilities only: Tankful sees odometer readings and
 * litres, so it is in no position to diagnose a vehicle.
 */
export const ANOMALY_POSSIBLE_FACTORS =
  'Traffic, longer idling, a heavier load, air-conditioning use, tyre pressure, fuel quality or a due service can all move a result like this.';
