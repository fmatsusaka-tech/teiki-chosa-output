const gvizPattern = /^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/;
const hyphenatedCalendarPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const slashedCalendarPattern = /^(\d{4})\/(\d{2})\/(\d{2})$/;
const zonedDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/;

const toCalendarDate = (year: number, month: number, day: number, onInvalid: () => never): string => {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    onInvalid();
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export type CalendarDateParseOptions = {
  /** Whether the string is trimmed before pattern matching (registeredAt) or matched raw (measuredAt). */
  trimBeforeMatching: boolean;
  /** Whether a fractional Google Sheets serial value is floored (registeredAt) or rejected (measuredAt). */
  allowFractionalSerial: boolean;
  /** Whether a negative Google Sheets serial value is rejected. Per docs/analysis-data-interface-contract.md, only registeredAt documents this constraint. */
  requireNonNegativeSerial: boolean;
  /** Whether the ISO string produced from a serial value is guarded against out-of-range years before slicing. */
  validateIsoDatePrefix: boolean;
};

/**
 * Resolves a Google Sheets cell value (already known to be non-blank) to a
 * `YYYY-MM-DD` calendar date, or calls `onInvalid` for anything that does not
 * match one of the supported formats (GViz `Date(y,m,d)`, `YYYY-MM-DD`,
 * `YYYY/MM/DD`, zoned ISO 8601, or a Sheets date serial number).
 *
 * `登録日時`(registeredAt) and `計測日`(measuredAt) share this exact parsing
 * logic; `options` captures the few points where their contracts diverge
 * (see docs/analysis-data-interface-contract.md).
 */
export const resolveSheetsCalendarDate = (
  value: unknown,
  options: CalendarDateParseOptions,
  onInvalid: () => never,
): string => {
  if (typeof value === "string") {
    const text = options.trimBeforeMatching ? value.trim() : value;

    const gviz = gvizPattern.exec(text);
    if (gviz) {
      return toCalendarDate(Number(gviz[1]), Number(gviz[2]) + 1, Number(gviz[3]), onInvalid);
    }

    const calendar = hyphenatedCalendarPattern.exec(text) ?? slashedCalendarPattern.exec(text);
    if (calendar) {
      return toCalendarDate(Number(calendar[1]), Number(calendar[2]), Number(calendar[3]), onInvalid);
    }

    const zoned = zonedDateTimePattern.exec(text);
    if (zoned) {
      toCalendarDate(Number(zoned[1]), Number(zoned[2]), Number(zoned[3]), onInvalid);
      const hour = Number(zoned[4]);
      const minute = Number(zoned[5]);
      const second = Number(zoned[6] ?? "0");
      const offset = zoned[8]!;
      const offsetHour = offset === "Z" ? 0 : Number(offset.slice(1, 3));
      const offsetMinute = offset === "Z" ? 0 : Number(offset.slice(4, 6));
      if (
        hour > 23 || minute > 59 || second > 59
        || offsetHour > 14 || offsetMinute > 59
        || (offsetHour === 14 && offsetMinute !== 0)
      ) {
        onInvalid();
      }
      const instant = new Date(text);
      if (Number.isNaN(instant.getTime())) onInvalid();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(instant);
      const part = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find((item) => item.type === type)?.value ?? "";
      return `${part("year")}-${part("month")}-${part("day")}`;
    }

    onInvalid();
  }

  if (
    typeof value === "number"
    && Number.isFinite(value)
    && (options.allowFractionalSerial || Number.isInteger(value))
    && (!options.requireNonNegativeSerial || value >= 0)
  ) {
    const serialDays = options.allowFractionalSerial ? Math.floor(value) : value;
    const date = new Date(Date.UTC(1899, 11, 30) + serialDays * 86_400_000);
    if (!Number.isNaN(date.getTime())) {
      const iso = date.toISOString();
      if (!options.validateIsoDatePrefix || /^\d{4}-\d{2}-\d{2}T/.test(iso)) {
        return iso.slice(0, 10);
      }
    }
  }

  onInvalid();
};
