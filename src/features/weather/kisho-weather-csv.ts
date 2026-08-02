import type { DailyWeatherRecord } from "./weather-30-day";

const REQUIRED_HEADERS = ["年月日", "降水量（湯浅）", "平均気温（川辺）", "降水量（川辺・比較用）"] as const;

const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
};

const parseOptionalNumber = (value: string | undefined, rowNumber: number, header: string): number | null => {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new KishoWeatherCsvError("INVALID_VALUE", `気象データの値が不正です（${rowNumber}行目・${header}）。`);
  }
  return parsed;
};

export class KishoWeatherCsvError extends Error {
  constructor(public readonly code: "EMPTY_DATA" | "INVALID_HEADER" | "INVALID_DATE" | "INVALID_VALUE", message: string) {
    super(message);
    this.name = "KishoWeatherCsvError";
  }
}

export const decodeKishoWeatherCsv = (text: string): DailyWeatherRecord[] => {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new KishoWeatherCsvError("EMPTY_DATA", "気象データが空です。");

  const indexes = Object.fromEntries(REQUIRED_HEADERS.map((header) => [header, rows[0].indexOf(header)])) as Record<(typeof REQUIRED_HEADERS)[number], number>;
  if (Object.values(indexes).some((index) => index < 0)) {
    throw new KishoWeatherCsvError("INVALID_HEADER", "気象データの見出しが契約と一致しません。");
  }

  return rows.slice(1).flatMap((row, index): DailyWeatherRecord[] => {
    const rowNumber = index + 2;
    const rawDate = row[indexes["年月日"]]?.trim();
    const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(rawDate ?? "");
    if (!match) throw new KishoWeatherCsvError("INVALID_DATE", `気象データの日付が不正です（${rowNumber}行目）。`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const parsedDate = new Date(timestamp);
    if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
      throw new KishoWeatherCsvError("INVALID_DATE", `気象データの日付が不正です（${rowNumber}行目）。`);
    }
    const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return [
      {
        date,
        stationId: "yuasa",
        precipitationMm: parseOptionalNumber(row[indexes["降水量（湯浅）"]], rowNumber, "降水量（湯浅）"),
        meanTemperatureC: null,
      },
      {
        date,
        stationId: "kawabe",
        precipitationMm: parseOptionalNumber(row[indexes["降水量（川辺・比較用）"]], rowNumber, "降水量（川辺）"),
        meanTemperatureC: parseOptionalNumber(row[indexes["平均気温（川辺）"]], rowNumber, "平均気温（川辺）"),
      },
    ];
  });
};
