import { describe, expect, it } from "vitest";
import {
  predictionCoefficientHeaders,
  predictionCoefficientSheetTitle,
  predictionMetricOrder,
  predictionModelHeaders,
  predictionModelOrder,
  predictionModelSheetTitle,
  sourceSheetByMetric,
} from "./prediction-master-contract";
import {
  decodePredictionMasterSheets,
  PredictionMasterDecodeError,
  type PredictionMasterCellValue,
  type PredictionMasterSheetData,
} from "./prediction-master-sheet-decoder";

const version = "1.0.0";
const generatedAt = "2026-08-01T12:34:56+09:00";

const sheets = (): PredictionMasterSheetData[] => [
  {
    title: predictionModelSheetTitle,
    values: [
      [...predictionModelHeaders],
      ...predictionModelOrder.map((model) => [
        model,
        model,
        "01-03",
        true,
        "",
        "",
        version,
        generatedAt,
      ]),
    ],
  },
  {
    title: predictionCoefficientSheetTitle,
    values: [
      [...predictionCoefficientHeaders],
      ...predictionMetricOrder.flatMap((metric) =>
        predictionModelOrder.flatMap((model) =>
          ["01-01", "01-02", "01-03"].map((monthDay, index) => [
            metric,
            model,
            monthDay,
            index + 1,
            sourceSheetByMetric[metric],
            `'${sourceSheetByMetric[metric]}'!A${index + 1}`,
            version,
            generatedAt,
          ]),
        ),
      ),
    ],
  },
];

const mutableValues = (
  sheet: PredictionMasterSheetData,
): PredictionMasterCellValue[][] =>
  sheet.values.map((row) => [...row]);

const expectCode = (
  action: () => unknown,
  code: PredictionMasterDecodeError["code"],
): void => {
  try {
    action();
    throw new Error("例外が発生しませんでした。");
  } catch (error) {
    expect(error).toBeInstanceOf(PredictionMasterDecodeError);
    expect((error as PredictionMasterDecodeError).code).toBe(code);
  }
};

describe("Prediction Master sheet decoder", () => {
  it("正式2シートを見出し名で解決しBundleへ復元する", () => {
    const result = decodePredictionMasterSheets(sheets(), version);
    expect(result.models).toHaveLength(6);
    expect(result.coefficients).toHaveLength(54);
    expect(result.models[0]).toMatchObject({
      predictionModel: "ゆら早生",
      active: true,
    });
    expect(result.coefficients[0]).toMatchObject({
      metric: "横径",
      coefficient: 1,
    });
  });

  it("入力セル配列を変更せず、空文字を保持する", () => {
    const input = sheets();
    const before = structuredClone(input);
    const result = decodePredictionMasterSheets(input, version);
    expect(input).toEqual(before);
    expect(result.models[0].selectionCriteria).toBe("");
    expect(result.models[0].sourceYears).toBe("");
  });

  it("両シート欠落と片方欠落を拒否する", () => {
    expectCode(() => decodePredictionMasterSheets([], version), "SHEET_MISSING");
    expectCode(
      () => decodePredictionMasterSheets([sheets()[0]], version),
      "SHEET_MISSING",
    );
  });

  it.each([
    ["欠落", (header: PredictionMasterCellValue[]) => header.slice(0, -1)],
    ["重複", (header: PredictionMasterCellValue[]) => [header[0], ...header.slice(0, -1)]],
    ["追加", (header: PredictionMasterCellValue[]) => [...header, "未知列"]],
    ["順序変更", (header: PredictionMasterCellValue[]) => [header[1], header[0], ...header.slice(2)]],
  ])("見出し%sを拒否する", (_name, mutate) => {
    const input = sheets();
    const values = mutableValues(input[0]);
    values[0] = mutate(values[0]);
    input[0] = { ...input[0], values };
    expectCode(
      () => decodePredictionMasterSheets(input, version),
      "HEADER_MISMATCH",
    );
  });

  it("データ途中の空行を拒否し、末尾の未使用空行は無視する", () => {
    const invalid = sheets();
    const invalidValues = mutableValues(invalid[0]);
    invalidValues.splice(2, 0, []);
    invalid[0] = { ...invalid[0], values: invalidValues };
    expectCode(() => decodePredictionMasterSheets(invalid, version), "EMPTY_ROW");

    const valid = sheets();
    const validValues = mutableValues(valid[0]);
    validValues.push([], ["", ""]);
    valid[0] = { ...valid[0], values: validValues };
    expect(decodePredictionMasterSheets(valid, version).models).toHaveLength(6);
  });

  it("必須セルと省略された行末セルを欠測として拒否する", () => {
    const missing = sheets();
    const missingValues = mutableValues(missing[0]);
    missingValues[1][0] = "";
    missing[0] = { ...missing[0], values: missingValues };
    expectCode(() => decodePredictionMasterSheets(missing, version), "MISSING_CELL");

    const omitted = sheets();
    const omittedValues = mutableValues(omitted[0]);
    omittedValues[1] = omittedValues[1].slice(0, 7);
    omitted[0] = { ...omitted[0], values: omittedValues };
    expectCode(() => decodePredictionMasterSheets(omitted, version), "MISSING_CELL");
  });

  it.each([
    ["boolean文字列", 3, "TRUE"],
    ["文字列列の数値", 0, 123],
  ])("モデルの%sを拒否する", (_name, column, value) => {
    const input = sheets();
    const values = mutableValues(input[0]);
    values[1][column] = value;
    input[0] = { ...input[0], values };
    expectCode(
      () => decodePredictionMasterSheets(input, version),
      "INVALID_CELL_TYPE",
    );
  });

  it.each([
    ["数値文字列", "1.0"],
    ["0", 0],
    ["負数", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("係数の%sを拒否する", (_name, value) => {
    const input = sheets();
    const values = mutableValues(input[1]);
    values[1][3] = value;
    input[1] = { ...input[1], values };
    expectCode(
      () => decodePredictionMasterSheets(input, version),
      typeof value === "string" ? "INVALID_CELL_TYPE" : "INVALID_CELL_VALUE",
    );
  });

  it.each([
    ["モデル0件", (input: PredictionMasterSheetData[]) => ({ ...input[0], values: [input[0].values[0]] })],
    ["係数0件", (input: PredictionMasterSheetData[]) => ({ ...input[1], values: [input[1].values[0]] })],
    ["未知モデル", (input: PredictionMasterSheetData[]) => {
      const values = mutableValues(input[0]); values[1][1] = "未知モデル"; return { ...input[0], values };
    }],
    ["未知指標", (input: PredictionMasterSheetData[]) => {
      const values = mutableValues(input[1]); values[1][0] = "未知指標"; return { ...input[1], values };
    }],
    ["dataVersion不一致", (input: PredictionMasterSheetData[]) => {
      const values = mutableValues(input[0]); values[1][6] = "1.0.1"; return { ...input[0], values };
    }],
    ["generatedAt不正", (input: PredictionMasterSheetData[]) => {
      const values = mutableValues(input[0]); values[1][7] = "now"; return { ...input[0], values };
    }],
    ["generatedAt不一致", (input: PredictionMasterSheetData[]) => {
      const values = mutableValues(input[1]); values[1][7] = "2026-08-01T12:34:57+09:00"; return { ...input[1], values };
    }],
    ["原典追跡不一致", (input: PredictionMasterSheetData[]) => {
      const values = mutableValues(input[1]); values[1][5] = "'糖度予測'!A1"; return { ...input[1], values };
    }],
  ])("%sをBundle検証で拒否する", (_name, mutate) => {
    const input = sheets();
    const changed = mutate(input);
    if (changed.title === predictionModelSheetTitle) input[0] = changed;
    else input[1] = changed;
    expectCode(() => decodePredictionMasterSheets(input, version), "INVALID_BUNDLE");
  });

  it("重複キーを拒否する", () => {
    const input = sheets();
    const values = mutableValues(input[1]);
    values.push([...values[1]]);
    input[1] = { ...input[1], values };
    expectCode(() => decodePredictionMasterSheets(input, version), "INVALID_BUNDLE");
  });

  it("正式順不一致を自動ソートせず拒否する", () => {
    const input = sheets();
    const values = mutableValues(input[0]);
    [values[1], values[2]] = [values[2], values[1]];
    input[0] = { ...input[0], values };
    expectCode(() => decodePredictionMasterSheets(input, version), "ORDER_MISMATCH");
  });
});
