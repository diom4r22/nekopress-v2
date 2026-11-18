import type { DayOfWeek, ScheduleItem } from '../types.js';

const weekdays: DayOfWeek[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const dayMs = 86_400_000;

export function weekdayIn(date: Date, zone: string): DayOfWeek {
  const day = new Intl.DateTimeFormat('es', { timeZone: zone, weekday: 'long' }).format(date);
  return day.normalize('NFD').replace(/\p{M}/gu, '') as DayOfWeek;
}

export function broadcastInstant(item: ScheduleItem, now: Date): Date | null {
  if (item.airingAt === null) return null;
  if (item.airingAt !== undefined) {
    const date = new Date(item.airingAt * 1000);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  // Weekly timetables use Japanese broadcast notation, including times past 24:00.
  const time = /^(\d{1,2}):([0-5]\d)\s*JST$/.exec(item.timeJST);
  if (!time || Number(time[1]) >= 48) return null;
  const tokyo = new Date(now.getTime() + 9 * 3600_000);
  const monday = Date.UTC(tokyo.getUTCFullYear(), tokyo.getUTCMonth(), tokyo.getUTCDate())
    - ((tokyo.getUTCDay() + 6) % 7) * dayMs;
  return new Date(monday + ((weekdays.indexOf(item.day) + 6) % 7) * dayMs
    + (Number(time[1]) - 9) * 3600_000 + Number(time[2]) * 60_000);
}
