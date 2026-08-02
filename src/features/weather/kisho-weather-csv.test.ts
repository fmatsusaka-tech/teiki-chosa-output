import { describe, expect, it } from "vitest";
import { decodeKishoWeatherCsv, KishoWeatherCsvError } from "./kisho-weather-csv";
import { aggregateWeather30Days } from "./weather-30-day";

const header = "年月日,降水量（湯浅）,平均気温（川辺）,降水量（川辺・比較用）";

describe("kisho weather CSV decoder", () => {
  it("decodes Yuasa and Kawabe as separate daily station records", () => {
    expect(decodeKishoWeatherCsv(`${header}\n2026/7/31,12.5,27.4,8`)).toEqual([
      { date: "2026-07-31", stationId: "yuasa", precipitationMm: 12.5, meanTemperatureC: null },
      { date: "2026-07-31", stationId: "kawabe", precipitationMm: 8, meanTemperatureC: 27.4 },
    ]);
  });

  it("preserves missing weather values as null", () => {
    expect(decodeKishoWeatherCsv(`${header}\n2026/7/31,,,`)[0].precipitationMm).toBeNull();
  });

  it("rejects missing headers, invalid dates, and invalid numeric values", () => {
    expect(() => decodeKishoWeatherCsv("年月日\n2026/7/31")).toThrow(KishoWeatherCsvError);
    expect(() => decodeKishoWeatherCsv(`${header}\n2026/2/30,1,2,3`)).toThrow(/日付/);
    expect(() => decodeKishoWeatherCsv(`${header}\n2026/7/31,-1,2,3`)).toThrow(/値/);
  });

  it("switches the 30-day rainfall total between Yuasa and Kawabe while temperature remains Kawabe", () => {
    const body = Array.from({ length: 30 }, (_, index) => `2026/7/${index + 1},1,25,2`).join("\n");
    const records = decodeKishoWeatherCsv(`${header}\n${body}`);
    const yuasa = aggregateWeather30Days({ measuredAt: "2026-07-30", precipitationStationId: "yuasa", temperatureStationId: "kawabe", records });
    const kawabe = aggregateWeather30Days({ measuredAt: "2026-07-30", precipitationStationId: "kawabe", temperatureStationId: "kawabe", records });
    expect(yuasa).toEqual({ precipitation: { ok: true, value: 30 }, meanTemperature: { ok: true, value: 25 } });
    expect(kawabe).toEqual({ precipitation: { ok: true, value: 60 }, meanTemperature: { ok: true, value: 25 } });
  });
});
