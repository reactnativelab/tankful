import { EmptyState } from '@/components/EmptyState';
import type { ThemeColors } from '@/constants/theme';

interface ErrorStateProps {
  /** What failed to load, as it reads in "loading your ___" (e.g. "vehicles"). */
  what: string;
  onRetry: () => void;
  colors: ThemeColors;
}

/**
 * Shown when a data read fails, in place of the empty state -- an empty state
 * would tell the user their data is gone when the read just didn't work.
 */
export function ErrorState({ what, onRetry, colors }: ErrorStateProps) {
  return (
    <EmptyState
      icon="alert-circle-outline"
      message={`Couldn't load your ${what}. Your saved data hasn't been changed.`}
      buttonLabel="Try Again"
      onPress={onRetry}
      colors={colors}
    />
  );
}
