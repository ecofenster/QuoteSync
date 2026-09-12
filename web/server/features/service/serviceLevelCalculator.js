const DEFAULT_WEEK = Object.freeze({
  1: [["09:00", "17:00"]],
  2: [["09:00", "17:00"]],
  3: [["09:00", "17:00"]],
  4: [["09:00", "17:00"]],
  5: [["09:00", "17:00"]]
});

const minute = 60_000;
const parts = (value, timezone) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
  timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
}).formatToParts(value).filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));
const dayNumber = (short) => ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[short];
const localDateKey = (p) => `${p.year}-${p.month}-${p.day}`;
const localMinute = (p) => Number(p.hour) * 60 + Number(p.minute);
const timeMinute = (value) => { const [hour, minutes] = String(value).split(":").map(Number); return hour * 60 + minutes; };
const weekdayKeys = Object.freeze({ sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 });

function normalizeBusinessHours(input) {
  const source = input && typeof input === "object" ? input : DEFAULT_WEEK;
  const result = {};
  for (const [rawKey, rawIntervals] of Object.entries(source)) {
    const key = /^\d$/.test(rawKey) ? Number(rawKey) : weekdayKeys[rawKey.toLowerCase()];
    if (key === undefined || key < 0 || key > 6 || !Array.isArray(rawIntervals)) continue;
    result[key] = rawIntervals.map((interval) => {
      if (!Array.isArray(interval) || interval.length !== 2) throw Object.assign(new Error("Business hours require a start and end time."), { status: 422, code: "service_business_hours_invalid" });
      const start = timeMinute(interval[0]), end = timeMinute(interval[1]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end) throw Object.assign(new Error("Choose valid business-hour ranges."), { status: 422, code: "service_business_hours_invalid" });
      return [String(interval[0]), String(interval[1])];
    });
  }
  if (!Object.values(result).some((intervals) => intervals.length)) throw Object.assign(new Error("Configure at least one business-hours period."), { status: 422, code: "service_business_hours_required" });
  return result;
}

export function normalizeServicePolicy(input = {}) {
  const timezone = String(input.timezone || "Europe/London");
  try { new Intl.DateTimeFormat("en-GB", { timeZone: timezone }).format(new Date()); } catch { throw Object.assign(new Error("Choose a valid service-policy timezone."), { status: 422, code: "service_timezone_invalid" }); }
  const hours = normalizeBusinessHours(input.businessHours);
  const holidays = [...new Set((Array.isArray(input.holidays) ? input.holidays : []).map(String).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))];
  const targets = {};
  for (const key of ["first_response", "customer_update", "assessment_plan", "resolution"]) {
    const raw = input.targets?.[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) throw Object.assign(new Error("Service targets must be positive whole business minutes."), { status: 422, code: "service_target_invalid" });
    targets[key] = value;
  }
  const pauseRules = {};
  for (const key of Object.keys(targets)) pauseRules[key] = [...new Set((Array.isArray(input.pauseRules?.[key]) ? input.pauseRules[key] : []).filter((state) => ["customer", "supplier", "internal"].includes(state)))];
  return { timezone, businessHours: hours, holidays, targets, pauseRules };
}

export function isBusinessMinute(date, policy) {
  const p = parts(date, policy.timezone);
  if (policy.holidays.includes(localDateKey(p))) return false;
  const intervals = policy.businessHours[dayNumber(p.weekday)] || policy.businessHours[String(dayNumber(p.weekday))] || [];
  const at = localMinute(p);
  return intervals.some(([start, end]) => at >= timeMinute(start) && at < timeMinute(end));
}

export function addBusinessMinutes(start, amount, inputPolicy) {
  const policy = normalizeServicePolicy(inputPolicy);
  let remaining = Number(amount), cursor = new Date(start);
  if (!Number.isFinite(cursor.getTime()) || !Number.isInteger(remaining) || remaining < 0) throw new Error("Invalid business-time calculation input.");
  const guard = remaining + 527_040;
  let steps = 0;
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + minute);
    if (isBusinessMinute(cursor, policy)) remaining -= 1;
    steps += 1;
    if (steps > guard) throw new Error("Business-time calculation exceeded its bounded calendar window.");
  }
  while (!isBusinessMinute(cursor, policy)) {
    cursor = new Date(cursor.getTime() + minute);
    steps += 1;
    if (steps > guard) throw new Error("Business-time calculation exceeded its bounded calendar window.");
  }
  return cursor.toISOString();
}

export function businessMinutesBetween(start, end, inputPolicy) {
  const policy = normalizeServicePolicy(inputPolicy);
  let cursor = new Date(start), finish = new Date(end), total = 0, steps = 0;
  if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(finish.getTime()) || finish <= cursor) return 0;
  while (cursor < finish) {
    cursor = new Date(cursor.getTime() + minute);
    if (cursor <= finish && isBusinessMinute(cursor, policy)) total += 1;
    steps += 1;
    if (steps > 2_000_000) throw new Error("Business-time interval exceeded its bounded calendar window.");
  }
  return total;
}
