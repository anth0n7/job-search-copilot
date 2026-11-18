const pad = (n: number) => String(n).padStart(2, '0');

//The server sends interview times as UTC timestamps ("2026-11-09T15:00:00.000Z").
//A <input type="datetime-local"> only understands the local "2026-11-09T10:00" format, so we convert.
export function toDateTimeLocalValue(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

//...and back: the input's local time becomes a UTC timestamp, so the server stores the exact moment the user meant.
export function fromDateTimeLocalValue(value: string): string | null {
    if (value === '') return null;
    return new Date(value).toISOString();
}

//Application dates are plain "YYYY-MM-DD" strings with no time zone.
//new Date('2026-11-09') would be read as UTC and could show the day before, so we build the date from its parts.
export function formatDate(date: string | null): string {
    if (!date) return '—';
    const [year, month, day] = date.slice(0, 10).split('-').map(Number);
    return new Date(year!, month! - 1, day!).toLocaleDateString();
}
