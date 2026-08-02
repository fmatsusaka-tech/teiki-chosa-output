import { decodeKishoWeatherCsv } from "../../features/weather/kisho-weather-csv";
import type { DailyWeatherRecord } from "../../features/weather/weather-30-day";

const WEATHER_CSV_URL = "https://docs.google.com/spreadsheets/d/1o1sgFxmD0UGYHfpIVUZxRaE0NC1yKUFy7qXbZiOyWnA/export?format=csv&gid=186487642";

export class KishoWeatherRepositoryError extends Error {
  constructor(public readonly code: "FETCH_FAILED" | "INVALID_RESPONSE", message: string) {
    super(message);
    this.name = "KishoWeatherRepositoryError";
  }
}

export const loadKishoWeatherRecords = async (
  fetcher: typeof fetch = fetch,
): Promise<DailyWeatherRecord[]> => {
  let response: Response;
  try {
    response = await fetcher(WEATHER_CSV_URL, { method: "GET", cache: "no-store" });
  } catch {
    throw new KishoWeatherRepositoryError("FETCH_FAILED", "気象データへ接続できませんでした。");
  }
  if (!response.ok) {
    throw new KishoWeatherRepositoryError("FETCH_FAILED", "気象データを取得できませんでした。");
  }

  let body: string;
  try {
    body = await response.text();
    return decodeKishoWeatherCsv(body);
  } catch (error) {
    if (error instanceof KishoWeatherRepositoryError) throw error;
    throw new KishoWeatherRepositoryError("INVALID_RESPONSE", "気象データの形式を確認できませんでした。");
  }
};
