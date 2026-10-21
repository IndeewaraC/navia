// Navia's budget calendar stays in Winnipeg even when the server runs in UTC
// or the user travels. Calendar-day arithmetic also avoids DST-short/long days.
export const PAY_CYCLE_TIME_ZONE = 'America/Winnipeg';
const DAY_MS = 86_400_000;

export interface PayCycleStatus {
  cycle_start: string;
  cycle_end: string;
  next_pay_date: string;
  days_remaining: number;
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

function dateFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

// Calculate on the application server so a code deployment fixes the live
// dashboard and alerts together, without depending on a separate SQL release.
export function getPayCycleStatus(anchorDate: string | null | undefined, now: Date = new Date()): PayCycleStatus {
  const today = localCalendarDate(now);
  const currentDay = calendarDay(today)!;
  const monthStart = calendarDay(`${today.slice(0, 7)}-01`)!;
  const nextMonth = new Date(monthStart * DAY_MS);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const nextMonthDay = nextMonth.getTime() / DAY_MS;
  const anchorDay = anchorDate ? calendarDay(anchorDate) : null;

  if (anchorDay === null) {
    return {
      cycle_start: dateFromDay(monthStart), cycle_end: dateFromDay(nextMonthDay - 1),
      next_pay_date: dateFromDay(nextMonthDay), days_remaining: nextMonthDay - 1 - currentDay,
      is_magic_month: false, paydays_this_month: 0, is_configured: false,
    };
  }

  // floor (rather than truncation) also keeps a future anchor aligned.
  const cycleStart = anchorDay + Math.floor((currentDay - anchorDay) / 14) * 14;
  const firstPayday = anchorDay + Math.ceil((monthStart - anchorDay) / 14) * 14;
  const paydays = Math.floor((nextMonthDay - 1 - firstPayday) / 14) + 1;
  return {
    cycle_start: dateFromDay(cycleStart), cycle_end: dateFromDay(cycleStart + 13),
    next_pay_date: dateFromDay(cycleStart + 14), days_remaining: cycleStart + 13 - currentDay,
    is_magic_month: paydays === 3, paydays_this_month: paydays, is_configured: true,
  };
}
