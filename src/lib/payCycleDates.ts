// Navia's budget calendar stays in Winnipeg even when the server runs in UTC
// or the user travels. Calendar-day arithmetic also avoids DST-short/long days.
export const PAY_CYCLE_TIME_ZONE = 'America/Winnipeg';
const DAY_MS = 86_400_000;

export interface PayCycleStatus {
  cycle_start: string;
  cycle_end: string;
  spend_end: string;
  next_pay_date: string | null;
  days_remaining: number | null;
  is_magic_month: boolean;
  paydays_this_month: number;
  is_configured: boolean;
}

export function localCalendarDate(date: Date = new Date(), timeZone = PAY_CYCLE_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function calendarDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const milliseconds = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value) return null;
  return milliseconds / DAY_MS;
}

export function isCalendarDate(value: unknown): value is string {
  return typeof value === 'string' && calendarDay(value) !== null;
}

function dateFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

// The selected date is the next reset itself, not a recurring payday seed.
// Keep the persisted cycle start when the user reschedules next month's reset.
export function getPayCycleStatus(anchorDate: string | null | undefined, now: Date = new Date(), savedCycleStart?: string | null): PayCycleStatus {
  const today = localCalendarDate(now);
  const currentDay = calendarDay(today)!;
  const monthStart = calendarDay(`${today.slice(0, 7)}-01`)!;
  const anchorDay = anchorDate ? calendarDay(anchorDate) : null;
  const savedDay = isCalendarDate(savedCycleStart) ? calendarDay(savedCycleStart)! : null;
  const currentStart = savedDay !== null && savedDay <= currentDay ? savedDay : null;

  if (anchorDay === null) {
    return {
      cycle_start: dateFromDay(currentStart ?? monthStart), cycle_end: today, spend_end: today,
      next_pay_date: null, days_remaining: null,
      is_magic_month: false, paydays_this_month: 0, is_configured: false,
    };
  }

  if (anchorDay <= currentDay) {
    return {
      // An explicitly saved past anchor is authoritative, including corrections
      // to an earlier date. A previously inferred start must never override it.
      cycle_start: dateFromDay(anchorDay), cycle_end: today, spend_end: today,
      next_pay_date: null, days_remaining: null,
      is_magic_month: false, paydays_this_month: 0, is_configured: true,
    };
  }

  // Bootstrap existing monthly configurations once. The caller persists this
  // start, so a later date edit or calendar month cannot discard current spend.
  const previousMonth = new Date(anchorDay * DAY_MS);
  const resetDayOfMonth = previousMonth.getUTCDate();
  previousMonth.setUTCDate(1);
  const previousMonthEnd = previousMonth.getTime() / DAY_MS - 1;
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const previousStart = Math.min(previousMonth.getTime() / DAY_MS + resetDayOfMonth - 1, previousMonthEnd);
  const initialStart = previousStart <= currentDay ? previousStart : monthStart;

  return {
    cycle_start: dateFromDay(currentStart ?? initialStart), cycle_end: dateFromDay(anchorDay - 1), spend_end: today,
    next_pay_date: anchorDate!, days_remaining: anchorDay - currentDay,
    // A manually chosen budget reset does not establish an income schedule.
    is_magic_month: false, paydays_this_month: 0, is_configured: true,
  };
}
