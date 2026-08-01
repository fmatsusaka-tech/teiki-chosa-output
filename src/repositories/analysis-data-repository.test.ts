import { describe, expect, it } from "vitest";
import { analysisDataHeaders } from "../contracts/analysis-data";
import { AnalysisDataRepository, type AnalysisDataTableSource } from "./analysis-data-repository";

const headers = Object.values(analysisDataHeaders);
const recordValues: Record<string, unknown> = {
  登録ID: "record-1",
  登録日時: "2026/07/20",
  計測日: "2026/07/20",
  年度: "2026",
  年: "2026",
  月: "7",
  調査基準月: "2026-07",
  調査区分: "後半",
  園地名: "吉川",
  品種: "ゆら早生",
  処理区: "",
  備考: "",
  横径個数: "5",
  横径平均: "42.74",
  横径最小: "41.8",
  横径最大: "43.4",
  糖度: "9.8",
  酸度: "1.25",
  糖酸比: "7.84",
  データ状態: "正常",
  入力方法: "text",
  入力者: "",
  送信元: "input",
};

const table = (headerRow = headers, values = recordValues): unknown[][] => [
  headerRow,
  headerRow.map((header) => values[header]),
];

const source = (rows: unknown[][] | null): AnalysisDataTableSource => ({
  readTab: async (tabName) => {
    expect(tabName).toBe("調査データ");
    return rows;
  },
});

describe("AnalysisDataRepository", () => {
  it("maps a row by header name", async () => {
    const records = await new AnalysisDataRepository(source(table())).getAll();

    expect(records).toEqual([expect.objectContaining({
      id: "record-1",
      orchard: "吉川",
      averageDiameter: 42.74,
      treatment: null,
      brix: 9.8,
    })]);
  });

  it("preserves missing observations and converts Google Sheets date serial values", async () => {
    const values = {
      ...recordValues,
      登録日時: 25569,
      計測日: "",
      園地名: "",
      横径個数: "",
      横径平均: "",
      横径最小: "",
      横径最大: "",
    };
    const [parsed] = await new AnalysisDataRepository(source(table(headers, values))).getAll();

    expect(parsed).toMatchObject({
      registeredAt: "1970-01-01T00:00:00.000Z",
      measuredAt: null,
      orchard: null,
      diameterCount: null,
      averageDiameter: null,
      minimumDiameter: null,
      maximumDiameter: null,
    });
  });

  it.each([
    ["Date(2026,6,20)", "2026-07-20"],
    ["Date(2024,1,29)", "2024-02-29"],
    ["2026-07-20", "2026-07-20"],
    ["2026/07/20", "2026-07-20"],
    ["2026-07-20T16:00:00Z", "2026-07-21"],
    ["2026-07-20T00:30:00+09:00", "2026-07-20"],
    [25569, "1970-01-01"],
  ])("normalizes measuredAt %s to a calendar date", async (measuredAt, expected) => {
    const values = { ...recordValues, 計測日: measuredAt };
    const [parsed] = await new AnalysisDataRepository(source(table(headers, values))).getAll();

    expect(parsed.measuredAt).toBe(expected);
  });

  it.each([
    "Date(2023,1,29)",
    "Date(2026,12,1)",
    "Date(2026,6,20) trailing",
    " Date(2026,6,20)",
    "2026-02-29",
    "2026/13/01",
    "2026/07-20",
    "2026-07/20",
    "2026-07-20T12:00:00",
    "unknown",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    25569.5,
  ])("rejects invalid measuredAt %s without date rollover", async (measuredAt) => {
    const values = { ...recordValues, 計測日: measuredAt };
    const promise = new AnalysisDataRepository(source(table(headers, values))).getAll();

    await expect(promise).rejects.toMatchObject({
      name: "AnalysisDataError",
      code: "INVALID_MEASURED_AT",
    });
  });

  it.each([null, undefined, "", "　", "   "])("keeps missing measuredAt %s as null without fallback", async (measuredAt) => {
    const values = {
      ...recordValues,
      計測日: measuredAt,
      登録日時: "2026/07/20",
      年: "2026",
      月: "7",
    };
    const [parsed] = await new AnalysisDataRepository(source(table(headers, values))).getAll();

    expect(parsed.measuredAt).toBeNull();
  });

  it("is independent of column order", async () => {
    const reversedHeaders = [...headers].reverse();
    const records = await new AnalysisDataRepository(source(table(reversedHeaders))).getAll();

    expect(records[0]).toMatchObject({ variety: "ゆら早生", acidity: 1.25 });
  });

  it("rejects empty data", async () => {
    await expect(new AnalysisDataRepository(source([headers])).getAll()).rejects.toThrow("データ行がありません");
  });

  it("rejects a missing 調査データ tab", async () => {
    await expect(new AnalysisDataRepository(source(null)).getAll()).rejects.toThrow("タブが存在しません");
  });

  it("rejects a missing required header", async () => {
    const incompleteHeaders = headers.filter((header) => header !== "横径平均");
    await expect(new AnalysisDataRepository(source(table(incompleteHeaders))).getAll()).rejects.toThrow("横径平均");
  });

  it("rejects an invalid numeric value", async () => {
    const invalidValues = { ...recordValues, 横径平均: "invalid" };
    await expect(new AnalysisDataRepository(source(table(headers, invalidValues))).getAll()).rejects.toThrow("横径平均");
  });

  it.each(["", " ", "　", null, undefined])("keeps optional numeric missing value %s as null", async (averageDiameter) => {
    const values = { ...recordValues, 横径平均: averageDiameter };
    const [parsed] = await new AnalysisDataRepository(source(table(headers, values))).getAll();

    expect(parsed.averageDiameter).toBeNull();
  });

  it.each([" ", "　", null, undefined, "not-number", Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects required numeric missing or invalid value %s",
    async (year) => {
      const values = { ...recordValues, 年: year };
      await expect(new AnalysisDataRepository(source(table(headers, values))).getAll()).rejects.toMatchObject({
        name: "AnalysisDataError",
        code: "INVALID_NUMBER",
      });
    },
  );

  it.each([
    true,
    false,
    [],
    [42],
    {},
    () => 42,
    BigInt(42),
    Symbol("42"),
  ])("rejects non-number optional numeric input without coercion", async (averageDiameter) => {
    const values = { ...recordValues, 横径平均: averageDiameter };
    await expect(new AnalysisDataRepository(source(table(headers, values))).getAll()).rejects.toMatchObject({
      name: "AnalysisDataError",
      code: "INVALID_NUMBER",
    });
  });

  it.each([
    true,
    false,
    [],
    [2026],
    {},
    () => 2026,
    BigInt(2026),
    Symbol("2026"),
  ])("rejects non-number required numeric input without coercion", async (year) => {
    const values = { ...recordValues, 年: year };
    await expect(new AnalysisDataRepository(source(table(headers, values))).getAll()).rejects.toMatchObject({
      name: "AnalysisDataError",
      code: "INVALID_NUMBER",
    });
  });

  it("keeps valid number values and numeric strings", async () => {
    const values = { ...recordValues, 年: 2026, 横径平均: "42.74" };
    const [parsed] = await new AnalysisDataRepository(source(table(headers, values))).getAll();

    expect(parsed).toMatchObject({ year: 2026, averageDiameter: 42.74 });
  });

  it("filters standard records with the shared inclusion rule", async () => {
    const nonStandardValues: Record<string, unknown> = {
      ...recordValues,
      登録ID: "record-2",
      データ状態: "要確認",
    };
    const rows = [...table(), headers.map((header) => nonStandardValues[header])];
    const repository = new AnalysisDataRepository(source(rows));

    await expect(repository.getStandardRecords()).resolves.toHaveLength(1);
    await expect(repository.getStandardRecords({ includeNeedsReview: true })).resolves.toHaveLength(2);
    await expect(repository.getAll()).resolves.toHaveLength(2);
  });
});
