import { describe, expect, it } from "vitest";
import { resolveSheetsCalendarDate, type CalendarDateParseOptions } from "./sheets-calendar-date";

const lenient: CalendarDateParseOptions = {
  trimBeforeMatching: true,
  allowFractionalSerial: true,
  requireNonNegativeSerial: true,
  validateIsoDatePrefix: true,
};
const strict: CalendarDateParseOptions = {
  trimBeforeMatching: false,
  allowFractionalSerial: false,
  requireNonNegativeSerial: false,
  validateIsoDatePrefix: false,
};

const fail = (): never => { throw new Error("invalid"); };

describe("resolveSheetsCalendarDate", () => {
  it.each([
    ["Date(2026,6,2)", "2026-07-02"],
    ["2026-07-02", "2026-07-02"],
    ["2026/07/02", "2026-07-02"],
    ["2026-07-20T16:00:00Z", "2026-07-21"],
    ["2026-07-20T00:30:00+09:00", "2026-07-20"],
  ])("parses %s to %s regardless of trim option", (input, expected) => {
    expect(resolveSheetsCalendarDate(input, lenient, fail)).toBe(expected);
    expect(resolveSheetsCalendarDate(input, strict, fail)).toBe(expected);
  });

  it("rejects a non-existent calendar date", () => {
    expect(() => resolveSheetsCalendarDate("2026-02-29", strict, fail)).toThrow();
  });

  describe("trimBeforeMatching", () => {
    it("matches a padded string only when trimming is enabled", () => {
      expect(resolveSheetsCalendarDate(" 2026-07-02", lenient, fail)).toBe("2026-07-02");
      expect(() => resolveSheetsCalendarDate(" 2026-07-02", strict, fail)).toThrow();
    });
  });

  describe("allowFractionalSerial", () => {
    it("floors a fractional serial when allowed, rejects it otherwise", () => {
      expect(resolveSheetsCalendarDate(25569.75, lenient, fail)).toBe("1970-01-01");
      expect(() => resolveSheetsCalendarDate(25569.75, strict, fail)).toThrow();
    });

    it("accepts an integer serial under both options", () => {
      expect(resolveSheetsCalendarDate(25569, lenient, fail)).toBe("1970-01-01");
      expect(resolveSheetsCalendarDate(25569, strict, fail)).toBe("1970-01-01");
    });
  });

  describe("requireNonNegativeSerial", () => {
    it("rejects a negative serial only when required", () => {
      expect(() => resolveSheetsCalendarDate(-1, lenient, fail)).toThrow();
      expect(resolveSheetsCalendarDate(-1, strict, fail)).toBe("1899-12-29");
    });
  });

  it("rejects non-string, non-number values", () => {
    expect(() => resolveSheetsCalendarDate(true, strict, fail)).toThrow();
    expect(() => resolveSheetsCalendarDate(null, strict, fail)).toThrow();
    expect(() => resolveSheetsCalendarDate(undefined, strict, fail)).toThrow();
  });
});
