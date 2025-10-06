//
// Burndown chart utilities: calculate remaining story points per day given sprint window.
// Approximates when status transitions are unavailable by using resolutiondate.
//
// PUBLIC_INTERFACE
export function computeBurndown({ startDateISO, endDateISO, issues = [], storyPointsFieldId = 'customfield_10016' }) {
  /**
   * Compute burndown data for the sprint.
   * Inputs:
   *  - startDateISO: sprint start (inclusive)
   *  - endDateISO: sprint end (inclusive)
   *  - issues: normalized issues or raw Jira issues; if raw, must include fields with SP field id and resolutiondate
   * Returns array: [{ date: ISO, remaining: number, ideal: number }]
   */
  if (!startDateISO || !endDateISO) return [];
  const days = enumerateDays(startDateISO, endDateISO);
  if (days.length === 0) return [];

  // Sum total points; default 1 per issue if no story points
  const normalized = issues.map((it) => {
    const f = it?.fields || {};
    const points =
      typeof it?.points === 'number'
        ? it.points
        : typeof f[storyPointsFieldId] === 'number'
          ? f[storyPointsFieldId]
          : typeof f['customfield_10016'] === 'number'
            ? f['customfield_10016']
            : 1;
    // prefer direct normalized resolutiondate else fields
    const resolutiondate = it?.resolutiondate || f?.resolutiondate || null;
    return {
      points: Number.isFinite(points) ? points : 1,
      resolutiondate: resolutiondate,
    };
  });
  const totalPoints = normalized.reduce((acc, it) => acc + (it.points || 0), 0);

  // Pre-calc completion map: on day D, how many points were completed (decrement)
  const completionByDay = new Map();
  normalized.forEach((it) => {
    if (!it.resolutiondate) return;
    const d = toDayISO(it.resolutiondate);
    // Only decrement within sprint window
    if (isDayInRange(d, days[0], days[days.length - 1])) {
      completionByDay.set(d, (completionByDay.get(d) || 0) + (it.points || 0));
    }
  });

  // Compute daily remaining
  let remaining = totalPoints;
  const data = [];
  const len = days.length;
  days.forEach((d, idx) => {
    // Apply any completions for this day
    const dec = completionByDay.get(d) || 0;
    remaining = Math.max(0, remaining - dec);
    // Ideal line: linear from total to 0 across the sprint days
    const ideal = totalPoints * (1 - idx / (len - 1 || 1));
    data.push({
      date: d,
      remaining,
      ideal: round2(Math.max(0, ideal)),
    });
  });

  return data;
}

function enumerateDays(startISO, endISO) {
  const out = [];
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return out;
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur.getTime() <= last.getTime()) {
    out.push(toDayISO(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function toDayISO(d) {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isDayInRange(dayISO, startDayISO, endDayISO) {
  return dayISO >= startDayISO && dayISO <= endDayISO;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
