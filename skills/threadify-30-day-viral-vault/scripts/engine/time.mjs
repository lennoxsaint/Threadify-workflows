export function localClock(instant, timezone) {
  if (!Number.isFinite(Date.parse(instant))) throw new Error('Valid instant required.');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

// Enumerate current civil offsets; return a choice instead of silently shifting
// a nonexistent or duplicated wall-clock time at a daylight-saving transition.
export function resolveLocalTime(date, time, timezone, chosenInstant) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Valid local date and time required.');
  const nominal = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 10) !== date) throw new Error('Invalid local date.');
  const candidates = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = new Date(nominal - offset * 60_000).toISOString();
    const local = localClock(instant, timezone);
    if (local.date === date && local.time === time) candidates.push(instant);
  }
  candidates.sort();
  if (chosenInstant !== undefined) {
    if (!Number.isFinite(Date.parse(chosenInstant))) throw new Error('Invalid chosen instant.');
    const chosen = new Date(chosenInstant).toISOString();
    if (!candidates.includes(chosen)) throw new Error('Chosen instant does not match the local time and timezone.');
    return { status: 'resolved', instant: chosen, candidates };
  }
  return { status: candidates.length === 0 ? 'nonexistent' : candidates.length === 1 ? 'resolved' : 'ambiguous',
    instant: candidates.length === 1 ? candidates[0] : null, candidates };
}
