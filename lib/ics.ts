import { Platform } from 'react-native';
import type { EventRow } from './types';

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function formatUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// ponytail: no line folding (RFC 5545 75-octet limit) — fine for typical
// titles/locations, add folding if long descriptions ever break a strict
// parser.
export function buildIcs(groupName: string, events: EventRow[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trekly//' + escapeText(groupName) + '//EN', 'CALSCALE:GREGORIAN'];

  for (const e of events) {
    const start = new Date(e.start_time);
    const end = e.end_time ? new Date(e.end_time) : new Date(start.getTime() + 60 * 60000);
    lines.push('BEGIN:VEVENT', `UID:${e.id}@trekly`, `DTSTAMP:${formatUtc(new Date())}`);
    if (e.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(start)}`, `DTEND;VALUE=DATE:${formatDateOnly(end)}`);
    } else {
      lines.push(`DTSTART:${formatUtc(start)}`, `DTEND:${formatUtc(end)}`);
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// Web: trigger a browser download. Native: write to cache + open the share
// sheet so the user can hand the .ics off to their calendar app — a one-time
// import, not a live two-way sync (that would need expo-calendar plus a
// background sync job, out of scope here).
export async function exportEventsAsIcs(groupName: string, events: EventRow[]) {
  const ics = buildIcs(groupName, events);
  const filename = `${groupName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'calendar'}.ics`;

  if (Platform.OS === 'web') {
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const fileUri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, ics, { encoding: 'utf8' });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'text/calendar', UTI: 'com.apple.ical.ics' });
  }
}
