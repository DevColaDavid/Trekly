export function getMonthGrid(year: number, month: number): (Date | null)[][] {
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = new Array(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateInput(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

function buildDate(year: number, month: number, day: number, base: Date): Date | null {
  const d = new Date(year, month, day, base.getHours(), base.getMinutes(), 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
}

export function parseDateInput(text: string, base: Date): Date | null {
  const t = text.trim();
  if (!t) return null;

  // M/D/Y or M/D (year assumed from base)
  let m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const month = Number(m[1]) - 1;
    const day = Number(m[2]);
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : base.getFullYear();
    return buildDate(year, month, day, base);
  }

  // ISO YYYY-MM-DD
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return buildDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), base);
  }

  // Free text fallback: "Aug 17 2026", "August 17, 2026", "17 Aug 2026", etc.
  const parsed = new Date(t);
  if (!isNaN(parsed.getTime())) {
    return buildDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), base);
  }

  return null;
}

export function formatTimeInput(d: Date): string {
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours12}:${minutes} ${hours24 >= 12 ? 'PM' : 'AM'}`;
}

export function parseTimeInput(text: string, base: Date): Date | null {
  const t = text.trim();

  let hours: number, minutes: number, period: string | undefined;

  // "5:30 PM", "17:30", "5:30pm"
  let m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (m) {
    hours = Number(m[1]);
    minutes = Number(m[2]);
    period = m[3];
  } else if ((m = t.match(/^(\d{1,2})\s*(AM|PM)$/i))) {
    // "5 PM", "5pm"
    hours = Number(m[1]);
    minutes = 0;
    period = m[2];
  } else {
    return null;
  }

  period = period?.toUpperCase();
  if (minutes > 59) return null;
  if (period) {
    if (hours < 1 || hours > 12) return null;
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export const WEEKDAY_LABELS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
