import { describe, expect, it } from "vitest";
import {
  predictionMetricOrder,
  predictionModelOrder,
  sourceSheetByMetric,
} from "./prediction-master-contract";
import {
  buildPredictionMasterBatch,
  guardPredictionMasterTarget,
  planPredictionMasterWrite,
  predictionCoefficientHeaders,
  predictionCoefficientSheetTitle,
  predictionMasterSpreadsheetTitle,
  predictionModelHeaders,
  predictionModelSheetTitle,
  PredictionMasterBatchStateUnknownError,
  PredictionMasterWriteStateUnknownError,
  runPredictionMasterWrite,
  serializePredictionMasters,
  verifyPredictionMasterReadback,
  type PredictionMasterSpreadsheetMetadata,
  type PredictionMasterTargetConfig,
  type PredictionMasterWriteProvider,
  type SerializedPredictionMasters,
} from "./prediction-master-writer";
import type { PredictionMasterBundle } from "./prediction-master.types";

const dataVersion = "1.0.0";
const generatedAt = "2026-07-30T12:34:56+09:00";
const config: PredictionMasterTargetConfig = {
  targetSpreadsheetId: "output-id",
  inputSpreadsheetId: "input-id",
  sourceSpreadsheetId: "source-id",
};

const bundle = (): PredictionMasterBundle => ({
  models: [...predictionModelOrder].reverse().map((predictionModel) => ({
    displayCategory: predictionModel,
    predictionModel,
    targetMonthDay: "01-03",
    active: true,
    selectionCriteria: "",
    sourceYears: "",
    dataVersion,
    generatedAt,
  })),
  coefficients: [...predictionMetricOrder].reverse().flatMap((metric) =>
    [...predictionModelOrder].reverse().flatMap((predictionModel) =>
      ["01-03", "01-02", "01-01"].map((monthDay, index) => ({
        metric,
        predictionModel,
        monthDay,
        coefficient: 3 - index,
        sourceSheet: sourceSheetByMetric[metric],
        sourceCell: `'${sourceSheetByMetric[metric]}'!A${4 - index}`,
        dataVersion,
        generatedAt,
      })),
    ),
  ),
});

const createMetadata = (): PredictionMasterSpreadsheetMetadata => ({
  spreadsheetId: config.targetSpreadsheetId,
  title: predictionMasterSpreadsheetTitle,
  sheets: [{ sheetId: 99, title: "説明", rowCount: 10, columnCount: 4 }],
});

const updateMetadata = (): PredictionMasterSpreadsheetMetadata => ({
  spreadsheetId: config.targetSpreadsheetId,
  title: predictionMasterSpreadsheetTitle,
  sheets: [
    {
      sheetId: 10,
      title: predictionModelSheetTitle,
      rowCount: 20,
      columnCount: 8,
      headers: [...predictionModelHeaders],
    },
    {
      sheetId: 11,
      title: predictionCoefficientSheetTitle,
      rowCount: 100,
      columnCount: 8,
      headers: [...predictionCoefficientHeaders],
    },
  ],
});

const cloneSerialized = (
  value: SerializedPredictionMasters,
): SerializedPredictionMasters => structuredClone(value);

describe("Prediction Master serialization", () => {
  it("モデルマスタを正式見出し・型・モデル順で直列化する", () => {
    const serialized = serializePredictionMasters(bundle(), dataVersion);
    expect(serialized.models.values[0]).toEqual(predictionModelHeaders);
    expect(serialized.models.values.slice(1).map((row) => row[1])).toEqual(
      predictionModelOrder,
    );
    expect(serialized.models.values[1].map((value) => typeof value)).toEqual([
      "string",
      "string",
      "string",
      "boolean",
      "string",
      "string",
      "string",
      "string",
    ]);
  });

  it("係数マスタを正式見出し・型・指標/モデル/月日順で直列化する", () => {
    const serialized = serializePredictionMasters(bundle(), dataVersion);
    expect(serialized.coefficients.values[0]).toEqual(
      predictionCoefficientHeaders,
    );
    expect(
      serialized.coefficients.values.slice(1, 4).map((row) => row.slice(0, 3)),
    ).toEqual([
      ["横径", "ゆら早生", "01-01"],
      ["横径", "ゆら早生", "01-02"],
      ["横径", "ゆら早生", "01-03"],
    ]);
    expect(typeof serialized.coefficients.values[1][3]).toBe("number");
  });

  it("元Bundleを変更しない", () => {
    const source = bundle();
    const before = structuredClone(source);
    serializePredictionMasters(source, dataVersion);
    expect(source).toEqual(before);
  });
});

describe("Prediction Master target guard", () => {
  it("target ID未設定を拒否する", async () => {
    let metadataReads = 0;
    await expect(
      planPredictionMasterWrite(
        bundle(),
        dataVersion,
        { ...config, targetSpreadsheetId: "" },
        {
          getMetadata: async () => {
            metadataReads += 1;
            return createMetadata();
          },
        },
      ),
    ).rejects.toThrow("PREDICTION_MASTER_SPREADSHEET_IDが未設定");
    expect(metadataReads).toBe(0);
  });

  it("Input正本IDと予測原典IDを拒否する", () => {
    expect(() =>
      guardPredictionMasterTarget(
        { ...config, targetSpreadsheetId: config.inputSpreadsheetId },
        { ...createMetadata(), spreadsheetId: config.inputSpreadsheetId },
      ),
    ).toThrow("Input正本Spreadsheet");
    expect(() =>
      guardPredictionMasterTarget(
        { ...config, targetSpreadsheetId: config.sourceSpreadsheetId },
        { ...createMetadata(), spreadsheetId: config.sourceSpreadsheetId },
      ),
    ).toThrow("予測原典Spreadsheet");
  });

  it("Spreadsheetタイトル不一致と禁止シートを拒否する", () => {
    expect(() =>
      guardPredictionMasterTarget(config, {
        ...createMetadata(),
        title: "別タイトル",
      }),
    ).toThrow("Spreadsheetタイトル");
    expect(() =>
      guardPredictionMasterTarget(config, {
        ...createMetadata(),
        sheets: [
          ...createMetadata().sheets,
          { sheetId: 1, title: "調査データ", rowCount: 1, columnCount: 1 },
        ],
      }),
    ).toThrow("禁止シート");
  });

  it("正式2シートが片方だけ存在する状態を拒否する", () => {
    const metadata = updateMetadata();
    metadata.sheets.pop();
    expect(() => guardPredictionMasterTarget(config, metadata)).toThrow(
      "片方だけ",
    );
  });

  it("既存見出し不一致を拒否する", () => {
    const metadata = updateMetadata();
    metadata.sheets[0].headers = ["誤見出し"];
    expect(() => guardPredictionMasterTarget(config, metadata)).toThrow(
      "既存見出し",
    );
  });
});

describe("Prediction Master batch request", () => {
  it("初回作成で2シート作成と更新を単一batchに含める", () => {
    const serialized = serializePredictionMasters(bundle(), dataVersion);
    const batch = buildPredictionMasterBatch(
      serialized,
      createMetadata(),
      "create",
    );
    expect(batch.requests).toHaveLength(4);
    expect(
      batch.requests.filter((request) => "addSheet" in request),
    ).toHaveLength(2);
    expect(
      batch.requests.filter((request) => "updateCells" in request),
    ).toHaveLength(2);
    expect(JSON.stringify(batch)).toContain('"fields":"userEnteredValue"');
  });

  it("更新で2シートを単一batchに含め、既存末尾行まで消去する", () => {
    const serialized = serializePredictionMasters(bundle(), dataVersion);
    const metadata = updateMetadata();
    metadata.sheets[1].rowCount = 500;
    const batch = buildPredictionMasterBatch(serialized, metadata, "update");
    expect(batch.requests).toHaveLength(2);
    const coefficient = batch.requests[1];
    if (!("updateCells" in coefficient))
      throw new Error("更新要求ではありません");
    expect(coefficient.updateCells.range?.endRowIndex).toBe(500);
    expect(coefficient.updateCells.rows).toHaveLength(500);
    expect(
      coefficient.updateCells.rows
        .at(-1)
        ?.values.every((cell) => cell.userEnteredValue === null),
    ).toBe(true);
  });
});

describe("Prediction Master writer flow", () => {
  const provider = (
    metadata: PredictionMasterSpreadsheetMetadata,
    actual?: SerializedPredictionMasters,
  ): PredictionMasterWriteProvider & {
    batchCalls: number;
    readCalls: number;
  } => {
    const result = {
      batchCalls: 0,
      readCalls: 0,
      getMetadata: async () => metadata,
      batchUpdate: async () => {
        result.batchCalls += 1;
      },
      readMasterSheets: async () => {
        result.readCalls += 1;
        if (!actual) throw new Error("再読込fixtureがありません");
        return actual;
      },
    };
    return result;
  };

  it("Dry-runと--executeなしでは書込み・再読込を行わない", async () => {
    const mock = provider(createMetadata());
    await runPredictionMasterWrite(bundle(), dataVersion, config, mock, false);
    expect(mock.batchCalls).toBe(0);
    expect(mock.readCalls).toBe(0);
  });

  it("Preflight失敗では書き込まない", async () => {
    const invalid = bundle();
    invalid.models = [];
    const mock = provider(createMetadata());
    await expect(
      runPredictionMasterWrite(invalid, dataVersion, config, mock, true),
    ).rejects.toThrow("予測モデル数");
    expect(mock.batchCalls).toBe(0);
  });

  it("batch成功後の再読込完全一致で成功する", async () => {
    const expected = serializePredictionMasters(bundle(), dataVersion);
    const mock = provider(createMetadata(), cloneSerialized(expected));
    await runPredictionMasterWrite(bundle(), dataVersion, config, mock, true);
    expect(mock.batchCalls).toBe(1);
    expect(mock.readCalls).toBe(1);
  });

  it.each([
    [
      "見出し",
      (actual: SerializedPredictionMasters) => {
        actual.models.values[0][0] = "誤見出し";
      },
    ],
    [
      "行数",
      (actual: SerializedPredictionMasters) => {
        actual.coefficients.values.pop();
      },
    ],
    [
      "キー",
      (actual: SerializedPredictionMasters) => {
        actual.models.values[1][1] = "別モデル";
      },
    ],
    [
      "値",
      (actual: SerializedPredictionMasters) => {
        actual.coefficients.values[1][3] = 999;
      },
    ],
    [
      "型",
      (actual: SerializedPredictionMasters) => {
        actual.coefficients.values[1][3] = "1";
      },
    ],
    [
      "順序",
      (actual: SerializedPredictionMasters) => {
        [actual.models.values[1], actual.models.values[2]] = [
          actual.models.values[2],
          actual.models.values[1],
        ];
      },
    ],
  ])("再読込%s不一致を拒否する", async (_, mutate) => {
    const expected = serializePredictionMasters(bundle(), dataVersion);
    const actual = cloneSerialized(expected);
    mutate(actual);
    expect(() => verifyPredictionMasterReadback(expected, actual)).toThrow(
      "再読込",
    );
  });

  it("再読込不一致時に自動再書込みしない", async () => {
    const actual = serializePredictionMasters(bundle(), dataVersion);
    actual.models.values[1][0] = "不一致";
    const mock = provider(createMetadata(), actual);
    await expect(
      runPredictionMasterWrite(bundle(), dataVersion, config, mock, true),
    ).rejects.toThrow("再読込値");
    expect(mock.batchCalls).toBe(1);
  });
  it("batch送信前の通信失敗では再読込しない", async () => {
    let batchCalls = 0;
    let readCalls = 0;
    const mock: PredictionMasterWriteProvider = {
      getMetadata: async () => createMetadata(),
      batchUpdate: async () => {
        batchCalls += 1;
        throw new Error("送信前に失敗");
      },
      readMasterSheets: async () => {
        readCalls += 1;
        throw new Error("呼ばれません");
      },
    };
    await expect(
      runPredictionMasterWrite(bundle(), dataVersion, config, mock, true),
    ).rejects.toThrow("送信前に失敗");
    expect(batchCalls).toBe(1);
    expect(readCalls).toBe(0);
  });

  it("batch送信後のtimeoutでは自動再送せず、再読込一致で適用済みと判定する", async () => {
    const expected = serializePredictionMasters(bundle(), dataVersion);
    let batchCalls = 0;
    let readCalls = 0;
    const mock: PredictionMasterWriteProvider = {
      getMetadata: async () => createMetadata(),
      batchUpdate: async () => {
        batchCalls += 1;
        throw new PredictionMasterBatchStateUnknownError();
      },
      readMasterSheets: async () => {
        readCalls += 1;
        return cloneSerialized(expected);
      },
    };
    const result = await runPredictionMasterWrite(
      bundle(),
      dataVersion,
      config,
      mock,
      true,
    );
    expect(result.status).toBe("confirmed-after-unknown");
    expect(batchCalls).toBe(1);
    expect(readCalls).toBe(1);
  });

  it("timeout後の再読込不一致は状態不明のまま終了する", async () => {
    const actual = serializePredictionMasters(bundle(), dataVersion);
    actual.models.values[1][0] = "不一致";
    let batchCalls = 0;
    const mock: PredictionMasterWriteProvider = {
      getMetadata: async () => createMetadata(),
      batchUpdate: async () => {
        batchCalls += 1;
        throw new PredictionMasterBatchStateUnknownError();
      },
      readMasterSheets: async () => actual,
    };
    await expect(
      runPredictionMasterWrite(bundle(), dataVersion, config, mock, true),
    ).rejects.toBeInstanceOf(PredictionMasterWriteStateUnknownError);
    expect(batchCalls).toBe(1);
  });

  it("timeout後の再読込失敗は状態不明のまま終了する", async () => {
    let batchCalls = 0;
    let readCalls = 0;
    const mock: PredictionMasterWriteProvider = {
      getMetadata: async () => createMetadata(),
      batchUpdate: async () => {
        batchCalls += 1;
        throw new PredictionMasterBatchStateUnknownError();
      },
      readMasterSheets: async () => {
        readCalls += 1;
        throw new Error("再読込通信失敗");
      },
    };
    await expect(
      runPredictionMasterWrite(bundle(), dataVersion, config, mock, true),
    ).rejects.toBeInstanceOf(PredictionMasterWriteStateUnknownError);
    expect(batchCalls).toBe(1);
    expect(readCalls).toBe(1);
  });

  it("状態不明エラーに秘密情報やSpreadsheet ID全体を含めない", () => {
    const message = new PredictionMasterWriteStateUnknownError().message;
    expect(message).not.toContain("output-id");
    expect(message).not.toContain("token");
    expect(message).not.toContain("private");
  });
});
