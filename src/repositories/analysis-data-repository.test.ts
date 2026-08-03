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
  有効状態: "",
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
      registeredAt: "1970-01-01",
      measuredAt: null,
      orchard: null,
      diameterCount: null,
      averageDiameter: null,
      minimumDiameter: null,
      maximumDiameter: null,
    });
  });

  it.each([
    ["Date(2026,6,2)", "2026-07-02"],
    ["2026-07-02", "2026-07-02"],
    ["2026/07/02", "2026-07-02"],
    ["2024/02/29", "2024-02-29"],
    ["2025-12-31", "2025-12-31"],
    ["2026-01-01", "2026-01-01"],
    ["2026-07-20T16:00:00Z", "2026-07-21"],
    ["2026-07-20T00:30:00+09:00", "2026-07-20"],
    [25569, "1970-01-01"],
    [25569.999999, "1970-01-01"],
  ])("normalizes registeredAt %s to a calendar date", async (registeredAt, expected) => {
    const values = { ...recordValues, 登録日時: registeredAt };
    const [parsed] = await new AnalysisDataRepository(source(table(headers, values))).getAll();

    expect(parsed.registeredAt).toBe(expected);
  });

  it.each([
    "Date(2023,1,29)",
    "Date(2026,12,1)",
    "Date(2026,6,20,10,30,0)",
    "2026-02-29",
    "2026/13/01",
    "2026/07-20",
    "2026-07/20",
    "2026-07-20 trailing",
    "2026-07-20T12:00:00",
    "unknown",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
  ])("rejects invalid registeredAt %s", async (registeredAt) => {
    const values = { ...recordValues, 登録日時: registeredAt };
    await expect(new AnalysisDataRepository(source(table(headers, values))).getAll()).rejects.toThrow(
      "登録日時",
    );
  });

  it.each([null, undefined, "", " ", "　"])("keeps missing registeredAt %s as null", async (registeredAt) => {
    const values = { ...recordValues, 登録日時: registeredAt };
    const [parsed] = await new AnalysisDataRepository(source(table(headers, values))).getAll();

    expect(parsed.registeredAt).toBeNull();
  });

  it("normalizes registeredAt independently of the process timezone", async () => {
    const originalTimezone = process.env.TZ;
    try {
      const values = { ...recordValues, 登録日時: 25569.75 };
      process.env.TZ = "UTC";
      const [utc] = await new AnalysisDataRepository(source(table(headers, values))).getAll();
      process.env.TZ = "America/Los_Angeles";
      const [losAngeles] = await new AnalysisDataRepository(source(table(headers, values))).getAll();

      expect(utc.registeredAt).toBe("1970-01-01");
      expect(losAngeles.registeredAt).toBe(utc.registeredAt);
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
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

  it("does not fill registeredAt from measuredAt or year and month", async () => {
    const values = { ...recordValues, 登録日時: null, 計測日: "2026-07-20", 年: 2026, 月: 7 };
    const [parsed] = await new AnalysisDataRepository(source(table(headers, values))).getAll();

    expect(parsed.registeredAt).toBeNull();
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

  it.each([
    [485, 48.5],
    ["485", 48.5],
    [100, 10],
    [999.9, 99.99],
    [99.9, 99.9],
    [1000, 1000],
  ])("normalizes legacy diameter value %s without changing values outside the legacy range", async (averageDiameter, expected) => {
    const values = { ...recordValues, 横径平均: averageDiameter };
    const [parsed] = await new AnalysisDataRepository(source(table(headers, values))).getAll();

    expect(parsed.averageDiameter).toBe(expected);
  });

  it("normalizes only average, minimum, and maximum legacy diameter columns", async () => {
    const values = {
      ...recordValues,
      横径個数: 485,
      横径平均: 485,
      横径最小: "420",
      横径最大: 510,
      糖度: 485,
      酸度: 485,
      糖酸比: 485,
    };
    const rows = table(headers, values);
    const snapshot = structuredClone(rows);
    const [parsed] = await new AnalysisDataRepository(source(rows)).getAll();

    expect(parsed).toMatchObject({
      diameterCount: 485,
      averageDiameter: 48.5,
      minimumDiameter: 42,
      maximumDiameter: 51,
      brix: 485,
      acidity: 485,
      brixAcidityRatio: 485,
    });
    expect(rows).toEqual(snapshot);
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

  it("skips a row with an invalid value and still returns the other valid rows", async () => {
    const good1: Record<string, unknown> = { ...recordValues, 登録ID: "good-1" };
    const bad: Record<string, unknown> = { ...recordValues, 登録ID: "bad", 計測日: "not-a-date" };
    const good2: Record<string, unknown> = { ...recordValues, 登録ID: "good-2" };
    const rows = [headers, ...[good1, bad, good2].map((values) => headers.map((header) => values[header]))];

    const records = await new AnalysisDataRepository(source(rows)).getAll();

    expect(records.map((record) => record.id)).toEqual(["good-1", "good-2"]);
  });

  it("throws the first row error when every row is invalid", async () => {
    const badDate: Record<string, unknown> = { ...recordValues, 登録ID: "bad-date", 計測日: "not-a-date" };
    const badNumber: Record<string, unknown> = { ...recordValues, 登録ID: "bad-number", 横径平均: "invalid" };
    const rows = [headers, ...[badDate, badNumber].map((values) => headers.map((header) => values[header]))];

    await expect(new AnalysisDataRepository(source(rows)).getAll()).rejects.toMatchObject({
      name: "AnalysisDataError",
      code: "INVALID_MEASURED_AT",
    });
  });

  it("excludes only rows explicitly marked 無効 from enabled records", async () => {
    const enabled: Record<string, unknown> = { ...recordValues, 登録ID: "enabled", 有効状態: "有効" };
    const blank: Record<string, unknown> = { ...recordValues, 登録ID: "blank", 有効状態: "" };
    const disabled: Record<string, unknown> = { ...recordValues, 登録ID: "disabled", 有効状態: " 無効 " };
    const rows = [
      headers,
      ...[enabled, blank, disabled].map((values) => headers.map((header) => values[header])),
    ];

    const repository = new AnalysisDataRepository(source(rows));

    await expect(repository.getEnabledRecords()).resolves.toEqual([
      expect.objectContaining({ id: "enabled", activationStatus: "有効" }),
      expect.objectContaining({ id: "blank", activationStatus: null }),
    ]);
    await expect(repository.getAll()).resolves.toHaveLength(3);
  });
});
