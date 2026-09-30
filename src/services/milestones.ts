import type { JournalEntry } from '../types';
import { getDayBalancedMetrics } from './journalTimeline';

const DAY_MS = 86_400_000;
const WEEKLY_TARGET = 3;
const MONTHLY_TARGET = 8;

export type MilestoneId =
  | 'first_piece'
  | 'first_gut_mood'
  | 'weekly_digest'
  | 'digestive_personality'
  | 'monthly_gallery'
  | 'season_of_gut'
  | 'gut_wrapped';

export type MilestoneStatus = {
  id: MilestoneId;
  order: number;
  title: string;
  timing: string;
  description: string;
  requirement: string;
  unlocked: boolean;
  progress: number;
  progressLabel: string;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function getHistory(entries: JournalEntry[]) {
  const timestamps = entries
    .map((entry) => new Date(entry.createdAt).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const spanDays = timestamps.length > 0 ? Math.floor((timestamps.at(-1)! - timestamps[0]) / DAY_MS) + 1 : 0;

  let weeklyWindowCount = 0;
  let left = 0;
  for (let right = 0; right < timestamps.length; right += 1) {
    while (timestamps[right] - timestamps[left] >= 7 * DAY_MS) left += 1;
    weeklyWindowCount = Math.max(weeklyWindowCount, right - left + 1);
  }

  const monthCounts = new Map<string, number>();
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    if (!Number.isFinite(date.getTime())) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const monthlyWindowCount = Math.max(0, ...monthCounts.values());

  return { count: entries.length, spanDays, weeklyWindowCount, monthlyWindowCount };
}

export function getMilestoneStatuses(entries: JournalEntry[]): MilestoneStatus[] {
  const { count, spanDays, weeklyWindowCount, monthlyWindowCount } = getHistory(entries);
  const compoundProgress = (entryTarget: number, dayTarget: number) => clamp(Math.min(count / entryTarget, spanDays / dayTarget));

  return [
    {
      id: 'first_piece', order: 1, title: 'Your First Piece', timing: '第 1 次',
      description: '你的第一件身體作品，收藏正式開始。', requirement: '完成第 1 次紀錄',
      unlocked: count >= 1, progress: clamp(count), progressLabel: `${Math.min(count, 1)} / 1 piece`,
    },
    {
      id: 'first_gut_mood', order: 2, title: 'Your First Gut Mood', timing: '3 次',
      description: '三件作品開始形成一種短期的腸道情緒。', requirement: '累積 3 次紀錄',
      unlocked: count >= 3, progress: clamp(count / 3), progressLabel: `${Math.min(count, 3)} / 3 pieces`,
    },
    {
      id: 'weekly_digest', order: 3, title: 'Weekly Digest', timing: '7 天',
      description: '第一次回看一週內的節奏，而不是單次結果。', requirement: '任意連續 7 天內至少完成 3 次紀錄',
      unlocked: weeklyWindowCount >= WEEKLY_TARGET, progress: clamp(weeklyWindowCount / WEEKLY_TARGET), progressLabel: `${Math.min(weeklyWindowCount, WEEKLY_TARGET)} / ${WEEKLY_TARGET} pieces within 7 days`,
    },
    {
      id: 'monthly_gallery', order: 4, title: 'Monthly Gallery', timing: '當月 8 次',
      description: '一個月的作品，成為一幅可以回看的身體肖像。', requirement: '同一個月份內至少完成 8 次紀錄',
      unlocked: monthlyWindowCount >= MONTHLY_TARGET, progress: clamp(monthlyWindowCount / MONTHLY_TARGET), progressLabel: `${Math.min(monthlyWindowCount, MONTHLY_TARGET)} / ${MONTHLY_TARGET} pieces in one month`,
    },
    {
      id: 'digestive_personality', order: 5, title: 'Digestive Personality', timing: '10 次',
      description: '從反覆出現的形態中，看見你的初步個人基線。', requirement: '累積 10 次紀錄',
      unlocked: count >= 10, progress: clamp(count / 10), progressLabel: `${Math.min(count, 10)} / 10 pieces`,
    },
    {
      id: 'season_of_gut', order: 6, title: 'Season of Your Gut', timing: '3 個月',
      description: '季節、生活與腸道狀態開始出現較長期的關係。', requirement: '橫跨 90 天並至少完成 20 次紀錄',
      unlocked: spanDays >= 90 && count >= 20, progress: compoundProgress(20, 90), progressLabel: `${Math.min(spanDays, 90)} / 90 days · ${Math.min(count, 20)} / 20 pieces`,
    },
    {
      id: 'gut_wrapped', order: 7, title: `Gut Wrapped ${new Date().getFullYear()}`, timing: '1 年',
      description: '把一年的身體資料，變成值得保存與分享的年度回顧。', requirement: '橫跨 365 天並至少完成 50 次紀錄',
      unlocked: spanDays >= 365 && count >= 50, progress: compoundProgress(50, 365), progressLabel: `${Math.min(spanDays, 365)} / 365 days · ${Math.min(count, 50)} / 50 pieces`,
    },
  ];
}

export function getCurrentMonthProgress(entries: JournalEntry[], now = new Date()) {
  const monthEntries = entries.filter((entry) => {
    const date = new Date(entry.createdAt);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  const count = monthEntries.length;
  const month = now.toLocaleString('en-US', { month: 'long' });
  return {
    month,
    count,
    target: MONTHLY_TARGET,
    remaining: Math.max(0, MONTHLY_TARGET - count),
    progress: clamp(count / MONTHLY_TARGET),
    ready: count >= MONTHLY_TARGET,
  };
}

function entriesWithValidDates(entries: JournalEntry[]) {
  return entries
    .filter((entry) => Number.isFinite(new Date(entry.createdAt).getTime()))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function getLatestQualifyingWeek(entries: JournalEntry[]) {
  for (let right = entries.length - 1; right >= 0; right -= 1) {
    const rightTime = new Date(entries[right].createdAt).getTime();
    let left = right;
    while (left > 0 && rightTime - new Date(entries[left - 1].createdAt).getTime() < 7 * DAY_MS) left -= 1;
    const window = entries.slice(left, right + 1);
    if (window.length >= WEEKLY_TARGET) return window;
  }
  return entries.slice(Math.max(0, entries.length - WEEKLY_TARGET));
}

function getLatestQualifyingMonth(entries: JournalEntry[]) {
  const groups = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const monthlyGroups = [...groups.values()];
  const qualifying = monthlyGroups.filter((group) => group.length >= MONTHLY_TARGET);
  if (qualifying.length > 0) return qualifying.at(-1)!;
  return monthlyGroups.sort((a, b) => b.length - a.length || new Date(b.at(-1)!.createdAt).getTime() - new Date(a.at(-1)!.createdAt).getTime())[0] ?? [];
}

/** Returns the exact journal entries that earned or explain a milestone. */
export function getMilestoneEntries(id: MilestoneId, entries: JournalEntry[]) {
  const chronological = entriesWithValidDates(entries);
  const latestTime = chronological.length > 0 ? new Date(chronological.at(-1)!.createdAt).getTime() : 0;

  switch (id) {
    case 'first_piece':
      return chronological.slice(0, 1);
    case 'first_gut_mood':
      return chronological.slice(0, 3);
    case 'weekly_digest':
      return getLatestQualifyingWeek(chronological);
    case 'monthly_gallery':
      return getLatestQualifyingMonth(chronological);
    case 'digestive_personality':
      return chronological.slice(0, 10);
    case 'season_of_gut':
      return chronological.filter((entry) => latestTime - new Date(entry.createdAt).getTime() < 90 * DAY_MS);
    case 'gut_wrapped':
      return chronological.filter((entry) => latestTime - new Date(entry.createdAt).getTime() < 365 * DAY_MS);
  }
}

export function getMilestoneReflection(id: MilestoneId, entries: JournalEntry[]) {
  const relevant = getMilestoneEntries(id, entries);
  const entryAverage = relevant.length > 0 ? relevant.reduce((sum, entry) => sum + entry.analysis.bristolType, 0) / relevant.length : 0;
  const dayMetrics = getDayBalancedMetrics(relevant);
  const usesDayBalance = id === 'digestive_personality' || id === 'season_of_gut' || id === 'gut_wrapped';
  const average = usesDayBalance ? dayMetrics.dayBalancedBristol : entryAverage;
  const healthyCount = relevant.filter((entry) => entry.analysis.bristolType >= 3 && entry.analysis.bristolType <= 5).length;
  const entryHealthyShare = relevant.length > 0 ? Math.round((healthyCount / relevant.length) * 100) : 0;
  const healthyShare = usesDayBalance ? dayMetrics.usualRangeDayShare : entryHealthyShare;
  const mood = average === 0 ? 'Still Becoming' : average < 3 ? 'Earthbound' : average <= 5 ? 'In Rhythm' : 'Fluid Motion';

  const copy: Record<MilestoneId, { eyebrow: string; title: string; body: string }> = {
    first_piece: { eyebrow: 'COLLECTION BEGINS', title: 'Your visual journal is alive.', body: '今天不是一個結論，而是你的個人基線開始形成的第一個資料點。' },
    first_gut_mood: { eyebrow: 'FIRST PATTERN', title: `Your Gut Mood is “${mood}”.`, body: '這只是三次紀錄形成的短期氣氛；繼續收藏，看看它會維持還是改變。' },
    weekly_digest: { eyebrow: '7-DAY REFLECTION', title: `${healthyShare}% of your pieces sat in the usual range.`, body: '週摘要的價值不是判斷單次好壞，而是看見這一週是否比平常更乾、更鬆或更穩定。' },
    digestive_personality: { eyebrow: 'PERSONAL BASELINE', title: `Your early rhythm is “${mood}”.`, body: '先把同一天的多次紀錄整合成每日平均，再跨日比較；排便頻率則獨立呈現，避免某一天過度影響你的個人基線。' },
    monthly_gallery: { eyebrow: 'MONTH IN FORM', title: `${relevant.length} moments became one portrait.`, body: '這個月的 Gallery 讓頻率、穩定度與視覺變化第一次可以被一起回看。' },
    season_of_gut: { eyebrow: 'SEASONAL SHIFT', title: 'Your body has a season, too.', body: '三個月的紀錄可以開始比較生活階段、旅行、壓力或飲食改變前後的差異。' },
    gut_wrapped: { eyebrow: 'A YEAR IN FORM', title: 'This was the year your gut became visible.', body: '一年的身體故事，被整理成一份可以反思、保存與選擇性分享的年度作品。' },
  };

  return {
    ...copy[id],
    mood,
    healthyShare,
    count: relevant.length,
    activeDays: dayMetrics.activeDays,
    averageVisitsPerActiveDay: dayMetrics.averageVisitsPerActiveDay ? dayMetrics.averageVisitsPerActiveDay.toFixed(1) : '—',
    average: average ? average.toFixed(1) : '—',
    usesDayBalance,
  };
}

export function isMilestoneId(value: string | undefined): value is MilestoneId {
  return ['first_piece', 'first_gut_mood', 'weekly_digest', 'digestive_personality', 'monthly_gallery', 'season_of_gut', 'gut_wrapped'].includes(value ?? '');
}
