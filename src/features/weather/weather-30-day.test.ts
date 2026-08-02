import { describe, expect, it } from "vitest";
import { aggregateWeather30Days, type DailyWeatherRecord } from "./weather-30-day";

const DAY_MS = 86_400_000;
const records = (end = "2026-01-10"): DailyWeatherRecord[] => {
  const endTime = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: 30 }, (_, index) => ({
    date: new Date(endTime - (29 - index) * DAY_MS).toISOString().slice(0, 10),
    stationId: "station-a",
    precipitationMm: 1,
    meanTemperatureC: 10 + index,
  }));
};

describe("aggregateWeather30Days", () => {
  it("uses the 30 calendar days ending on the measured date across a year boundary", () => {
    expect(aggregateWeather30Days({ measuredAt: "2026-01-10", precipitationStationId: "station-a", temperatureStationId: "station-a", records: records() })).toEqual({
      precipitation: { ok: true, value: 30 },
      meanTemperature: { ok: true, value: 24.5 },
    });
  });

  it("rejects 29 days instead of treating them as a 30-day value", () => {
    const result = aggregateWeather30Days({ measuredAt: "2026-01-10", precipitationStationId: "station-a", temperatureStationId: "station-a", records: records().slice(1) });
    expect(result.precipitation).toEqual({ ok: false, reason: "INCOMPLETE_PERIOD" });
    expect(result.meanTemperature).toEqual({ ok: false, reason: "INCOMPLETE_PERIOD" });
  });

  it("rejects a missing value without converting it to zero or excluding it", () => {
    const input = records(); input[10] = { ...input[10], precipitationMm: null, meanTemperatureC: null };
    const result = aggregateWeather30Days({ measuredAt: "2026-01-10", precipitationStationId: "station-a", temperatureStationId: "station-a", records: input });
    expect(result.precipitation).toEqual({ ok: false, reason: "MISSING_VALUE" });
    expect(result.meanTemperature).toEqual({ ok: false, reason: "MISSING_VALUE" });
  });

  it("rejects duplicate dates", () => {
    const input = records(); input.push({ ...input[0] });
    const result = aggregateWeather30Days({ measuredAt: "2026-01-10", precipitationStationId: "station-a", temperatureStationId: "station-a", records: input });
    expect(result.precipitation).toEqual({ ok: false, reason: "DUPLICATE_DATE" });
    expect(result.meanTemperature).toEqual({ ok: false, reason: "DUPLICATE_DATE" });
  });

  it("does not infer a station when an orchard mapping is absent", () => {
    const result = aggregateWeather30Days({ measuredAt: "2026-01-10", precipitationStationId: null, temperatureStationId: null, records: records() });
    expect(result.precipitation).toEqual({ ok: false, reason: "STATION_MAPPING_MISSING" });
    expect(result.meanTemperature).toEqual({ ok: false, reason: "STATION_MAPPING_MISSING" });
  });
});
