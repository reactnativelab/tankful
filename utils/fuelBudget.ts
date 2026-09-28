import type { VehicleBudget } from '@/types';

/**
 * Monthly fuel budget maths. A budget is a plain number the user sets for one
 * vehicle (see AppSettings.vehicleBudgets); nothing is stored per month, so
 * changing it re-reads every month against the new figure rather than
 * inventing a history of budgets that never existed.
 */

export type BudgetLevel = 'normal' | 'approaching' | 'high' | 'exceeded';

export interface BudgetStatus {
  amount: number;
  spent: number;
  /** Negative once spending has passed the budget; pair with `overBy` for display. */
  remaining: number;
  overBy: number;
  /** 0-100+, already rounded to one decimal so the bar and the label can't disagree. */
  percentUsed: number;
  level: BudgetLevel;
  /**
   * Plain-language status, so the meaning never rests on the colour alone.
   * (Colour is chosen from `level` by the UI.)
   */
  label: string;
}

/**
 * Bands for the status label. Deliberately calm at the bottom: most of a
 * month is spent under 70% of budget and that is not news. "Approaching"
 * starts where a user could still change their driving before month end.
 */
export const BUDGET_APPROACHING_PERCENT = 70;
export const BUDGET_HIGH_PERCENT = 90;

const LEVEL_LABELS: Record<BudgetLevel, string> = {
  normal: 'On track',
  approaching: 'Approaching your budget',
  high: 'Close to your budget',
  exceeded: 'Over budget',
};

function levelFor(percentUsed: number): BudgetLevel {
  if (percentUsed >= 100) return 'exceeded';
  if (percentUsed >= BUDGET_HIGH_PERCENT) return 'high';
  if (percentUsed >= BUDGET_APPROACHING_PERCENT) return 'approaching';
  return 'normal';
}

/**
 * Null when there is no usable budget -- not set, switched off, zero or
 * invalid. Callers treat null as "the user isn't budgeting", never as 0%.
 */
export function calculateBudgetStatus(
  spent: number,
  budget: VehicleBudget | null
): BudgetStatus | null {
  if (!budget || !budget.enabled) return null;
  if (!Number.isFinite(budget.amount) || budget.amount <= 0) return null;

  const safeSpent = Number.isFinite(spent) && spent > 0 ? spent : 0;
  const percentUsed = Math.round((safeSpent / budget.amount) * 1000) / 10;
  const remaining = budget.amount - safeSpent;

  return {
    amount: budget.amount,
    spent: safeSpent,
    remaining,
    overBy: remaining < 0 ? -remaining : 0,
    percentUsed,
    level: levelFor(percentUsed),
    label: LEVEL_LABELS[levelFor(percentUsed)],
  };
}

/** Bar fill fraction, 0-1. Spending past the budget fills the bar, it doesn't overflow it. */
export function budgetBarFraction(status: BudgetStatus): number {
  return Math.max(0, Math.min(1, status.percentUsed / 100));
}
