import type { JournalEntry } from '../types';

export type JournalDayGroup = {
  key: string;
  date: Date;
  entries: JournalEntry[];
};

function localDayKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return `invalid-${value}`;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Groups entries by the user's local calendar day, newest day and visit first. */
export function groupEntriesByLocalDay(entries: JournalEntry[]): JournalDayGroup[] {
  const sorted = [...entries]
    .filter((entry) => Number.isFinite(new Date(entry.createdAt).getTime()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const groups = new Map<string, JournalDayGroup>();

  for (const entry of sorted) {
    const key = localDayKey(entry.createdAt);
    const existing = groups.get(key);
    if (existing) existing.entries.push(entry);
    else groups.set(key, { key, date: new Date(entry.createdAt), entries: [entry] });
  }

  return [...groups.values()];
}

/** Visit numbers run chronologically within each day: first visit = 1. */
export function getVisitNumbers(entries: JournalEntry[]) {
  const result = new Map<string, number>();
  for (const group of groupEntriesByLocalDay(entries)) {
    [...group.entries]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((entry, index) => result.set(entry.id, index + 1));
  }
  return result;
}

/**
 * Day-balanced metrics stop a day with several visits from dominating a
 * personal baseline. Frequency remains available as a separate signal.
 */
export function getDayBalancedMetrics(entries: JournalEntry[]) {
  const groups = groupEntriesByLocalDay(entries);
  const dailyAverages = groups.map((group) => group.entries.reduce((sum, entry) => sum + entry.analysis.bristolType, 0) / group.entries.length);
  const dayBalancedBristol = dailyAverages.length > 0
    ? dailyAverages.reduce((sum, value) => sum + value, 0) / dailyAverages.length
    : 0;
  const usualRangeDays = dailyAverages.filter((value) => value >= 3 && value <= 5).length;

  return {
    activeDays: groups.length,
    averageVisitsPerActiveDay: groups.length > 0 ? entries.length / groups.length : 0,
    dayBalancedBristol,
    usualRangeDayShare: groups.length > 0 ? Math.round((usualRangeDays / groups.length) * 100) : 0,
  };
}
