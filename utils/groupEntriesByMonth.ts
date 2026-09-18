import type { FuelEntry } from '@/types';

export interface MonthSection {
  title: string;
  data: FuelEntry[];
}

/**
 * Entries arrive newest-first, already sorted by date, so months are
 * contiguous runs in that sequence -- a single adjacency pass groups them
 * without re-sorting. The title includes the year so December 2025 and
 * December 2026 never merge into one bucket.
 */
export function groupEntriesByMonth(entries: FuelEntry[]): MonthSection[] {
  const sections: MonthSection[] = [];

  for (const entry of entries) {
    const title = new Date(entry.date).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
    const current = sections[sections.length - 1];
    if (current && current.title === title) {
      current.data.push(entry);
    } else {
      sections.push({ title, data: [entry] });
    }
  }

  return sections;
}
