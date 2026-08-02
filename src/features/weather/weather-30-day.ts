export type DailyWeatherRecord = {
  date: string;
  stationId: string;
  precipitationMm: number | null;
  meanTemperatureC: number | null;
};

export type WeatherMetricOutcome =
  | { ok: true; value: number }
  | { ok: false; reason: "STATION_MAPPING_MISSING" | "DUPLICATE_DATE" | "INCOMPLETE_PERIOD" | "MISSING_VALUE" | "INVALID_DATE" };

export type Weather30DayOutcome = {
  precipitation: WeatherMetricOutcome;
  meanTemperature: WeatherMetricOutcome;
};

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDate = (value: string): number | null => {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? timestamp : null;
};

const dateAt = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10);

const aggregateMetric = (
  records: readonly DailyWeatherRecord[],
  stationId: string | null,
  dates: readonly string[],
  select: (record: DailyWeatherRecord) => number | null,
  aggregate: (values: readonly number[]) => number,
): WeatherMetricOutcome => {
  if (!stationId) return { ok: false, reason: "STATION_MAPPING_MISSING" };
  const byDate = new Map<string, DailyWeatherRecord>();
  for (const record of records) {
    if (record.stationId !== stationId || !dates.includes(record.date)) continue;
    if (byDate.has(record.date)) return { ok: false, reason: "DUPLICATE_DATE" };
    byDate.set(record.date, record);
  }
  if (byDate.size !== 30) return { ok: false, reason: "INCOMPLETE_PERIOD" };
  const values = dates.map((date) => select(byDate.get(date)!));
  if (values.some((value) => value === null || !Number.isFinite(value))) return { ok: false, reason: "MISSING_VALUE" };
  return { ok: true, value: aggregate(values as number[]) };
};

export const aggregateWeather30Days = ({
  measuredAt,
  precipitationStationId,
  temperatureStationId,
  records,
}: {
  measuredAt: string;
  precipitationStationId: string | null;
  temperatureStationId: string | null;
  records: readonly DailyWeatherRecord[];
}): Weather30DayOutcome => {
  const end = parseDate(measuredAt);
  if (end === null) {
    const invalid: WeatherMetricOutcome = { ok: false, reason: "INVALID_DATE" };
    return { precipitation: invalid, meanTemperature: invalid };
  }
  const dates = Array.from({ length: 30 }, (_, index) => dateAt(end - (29 - index) * DAY_MS));
  return {
    precipitation: aggregateMetric(records, precipitationStationId, dates, (record) => record.precipitationMm, (values) => values.reduce((sum, value) => sum + value, 0)),
    meanTemperature: aggregateMetric(records, temperatureStationId, dates, (record) => record.meanTemperatureC, (values) => values.reduce((sum, value) => sum + value, 0) / 30),
  };
};
