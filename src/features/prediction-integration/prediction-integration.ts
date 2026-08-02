import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { getPredictionModel, getVarietyCategory } from "../shared/variety-category";
import {
  calculatePrediction,
  roundPredictionForDisplay,
} from "../prediction-engine/prediction-engine";
import { predictionMetricOrder } from "../prediction-data/prediction-master-contract";
import type {
  PredictionCoefficientMaster,
  PredictionMasterBundle,
  PredictionMetric,
  PredictionModelMaster,
} from "../prediction-data/prediction-master.types";
import { validatePredictionMasters } from "../prediction-data/prediction-master-validator";
import type {
  PredictionIntegrationResult,
  PredictionMetricResult,
  PredictionNonCalculationCode,
  PredictionRecordResult,
} from "./prediction-integration.types";

const measuredFieldByMetric: Record<
  PredictionMetric,
  "averageDiameter" | "brix" | "acidity"
> = {
  横径: "averageDiameter",
  糖度: "brix",
  クエン酸: "acidity",
};

const reasonMessage: Record<PredictionNonCalculationCode, string> = {
  EMPTY_VARIETY: "品種が入力されていません。",
  UNREGISTERED_VARIETY: "予測対象として登録されていない品種です。",
  MODEL_NOT_FOUND: "対応する予測モデルがありません。",
  INACTIVE_MODEL: "予測モデルが無効です。",
  MISSING_MEASURED_AT: "計測日がありません。",
  TARGET_DATE_EXCEEDED: "計測日が収穫目標日を過ぎています。",
  INVALID_MEASURED_VALUE: "実測値が欠測、0以下、または不正です。",
  MEASURED_COEFFICIENT_NOT_FOUND: "計測日の係数がありません。",
  TARGET_COEFFICIENT_NOT_FOUND: "収穫目標日の係数がありません。",
  CALCULATION_FAILED: "予測値を計算できませんでした。",
};

const failedMetric = (
  metric: PredictionMetric,
  reason: PredictionNonCalculationCode,
): PredictionMetricResult => ({
  ok: false,
  metric,
  reason,
  message: reasonMessage[reason],
});

const allMetricsFailed = (
  reason: PredictionNonCalculationCode,
): Record<PredictionMetric, PredictionMetricResult> => ({
  横径: failedMetric("横径", reason),
  糖度: failedMetric("糖度", reason),
  クエン酸: failedMetric("クエン酸", reason),
});

const coefficientKey = (
  metric: PredictionMetric,
  predictionModel: string,
  monthDay: string,
): string => `${metric}\u0000${predictionModel}\u0000${monthDay}`;

const monthDayFromDate = (value: string): string | null => {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[1]}-${match[2]}` : null;
};

const baseRecord = (
  record: AnalysisDataRecord,
  dataVersion: string,
): Omit<PredictionRecordResult, "predictionModel" | "targetMonthDay" | "metrics"> => ({
  id: record.id,
  fiscalYear: record.fiscalYear,
  measuredYear: record.year,
  orchard: record.orchard,
  variety: record.variety,
  treatment: record.treatment,
  measuredAt: record.measuredAt,
  dataVersion,
});

const recordFailure = (
  record: AnalysisDataRecord,
  dataVersion: string,
  reason: PredictionNonCalculationCode,
  predictionModel: string | null = null,
  targetMonthDay: string | null = null,
): PredictionRecordResult => ({
  ...baseRecord(record, dataVersion),
  predictionModel,
  targetMonthDay,
  metrics: allMetricsFailed(reason),
});

const calculateMetric = (
  record: AnalysisDataRecord,
  metric: PredictionMetric,
  model: PredictionModelMaster,
  measuredMonthDay: string,
  expectedDataVersion: string,
  coefficientIndex: ReadonlyMap<string, PredictionCoefficientMaster>,
): PredictionMetricResult => {
  const measuredValue = record[measuredFieldByMetric[metric]];
  if (
    typeof measuredValue !== "number" ||
    !Number.isFinite(measuredValue) ||
    measuredValue <= 0
  ) {
    return failedMetric(metric, "INVALID_MEASURED_VALUE");
  }
  const measuredCoefficient = coefficientIndex.get(
    coefficientKey(metric, model.predictionModel, measuredMonthDay),
  );
  if (!measuredCoefficient) {
    return failedMetric(metric, "MEASURED_COEFFICIENT_NOT_FOUND");
  }
  const targetCoefficient = coefficientIndex.get(
    coefficientKey(metric, model.predictionModel, model.targetMonthDay),
  );
  if (!targetCoefficient) {
    return failedMetric(metric, "TARGET_COEFFICIENT_NOT_FOUND");
  }
  const outcome = calculatePrediction({
    metric,
    predictionModel: model.predictionModel,
    measuredValue,
    measuredMonthDay,
    targetMonthDay: model.targetMonthDay,
    model,
    measuredCoefficient,
    targetCoefficient,
    expectedDataVersion,
  });
  if (!outcome.ok) {
    return failedMetric(metric, "CALCULATION_FAILED");
  }
  return {
    ok: true,
    metric,
    measuredValue,
    predictedValue: roundPredictionForDisplay(metric, outcome.result.rawPrediction),
    rawPrediction: outcome.result.rawPrediction,
    measuredSourceSheet: outcome.result.measuredSourceSheet,
    measuredSourceCell: outcome.result.measuredSourceCell,
    targetSourceSheet: outcome.result.targetSourceSheet,
    targetSourceCell: outcome.result.targetSourceCell,
  };
};

export const buildPredictionResults = (
  records: readonly AnalysisDataRecord[],
  bundle: PredictionMasterBundle,
  expectedDataVersion: string,
): PredictionIntegrationResult => {
  validatePredictionMasters(bundle, expectedDataVersion);
  const modelIndex = new Map(
    bundle.models.map((model) => [model.predictionModel, model] as const),
  );
  const coefficientIndex = new Map(
    bundle.coefficients.map((coefficient) => [
      coefficientKey(
        coefficient.metric,
        coefficient.predictionModel,
        coefficient.monthDay,
      ),
      coefficient,
    ] as const),
  );

  const results = records.map((record): PredictionRecordResult => {
    const category = getVarietyCategory(record.variety);
    if (category === null) {
      return recordFailure(record, expectedDataVersion, "EMPTY_VARIETY");
    }
    const predictionModel = getPredictionModel(category);
    if (!predictionModel) {
      return recordFailure(record, expectedDataVersion, "UNREGISTERED_VARIETY");
    }
    const model = modelIndex.get(predictionModel);
    if (!model) {
      return recordFailure(
        record,
        expectedDataVersion,
        "MODEL_NOT_FOUND",
        predictionModel,
      );
    }
    if (model.active !== true) {
      return recordFailure(
        record,
        expectedDataVersion,
        "INACTIVE_MODEL",
        predictionModel,
        model.targetMonthDay,
      );
    }
    const measuredMonthDay = record.measuredAt
      ? monthDayFromDate(record.measuredAt)
      : null;
    if (!measuredMonthDay) {
      return recordFailure(
        record,
        expectedDataVersion,
        "MISSING_MEASURED_AT",
        predictionModel,
        model.targetMonthDay,
      );
    }
    if (measuredMonthDay > model.targetMonthDay) {
      return recordFailure(
        record,
        expectedDataVersion,
        "TARGET_DATE_EXCEEDED",
        predictionModel,
        model.targetMonthDay,
      );
    }
    return {
      ...baseRecord(record, expectedDataVersion),
      predictionModel,
      targetMonthDay: model.targetMonthDay,
      metrics: {
        横径: calculateMetric(
          record,
          "横径",
          model,
          measuredMonthDay,
          expectedDataVersion,
          coefficientIndex,
        ),
        糖度: calculateMetric(
          record,
          "糖度",
          model,
          measuredMonthDay,
          expectedDataVersion,
          coefficientIndex,
        ),
        クエン酸: calculateMetric(
          record,
          "クエン酸",
          model,
          measuredMonthDay,
          expectedDataVersion,
          coefficientIndex,
        ),
      },
    };
  });

  return {
    records: results,
    summary: {
      inputCount: results.length,
      selectableModelCount: results.filter(
        (record) => record.predictionModel !== null,
      ).length,
      unregisteredVarietyCount: results.filter(
        (record) => record.metrics.横径.ok === false && record.metrics.横径.reason === "UNREGISTERED_VARIETY",
      ).length,
      emptyVarietyCount: results.filter(
        (record) => record.metrics.横径.ok === false && record.metrics.横径.reason === "EMPTY_VARIETY",
      ).length,
      targetDateExceededCount: results.filter(
        (record) => record.metrics.横径.ok === false && record.metrics.横径.reason === "TARGET_DATE_EXCEEDED",
      ).length,
      calculableByMetric: Object.fromEntries(
        predictionMetricOrder.map((metric) => [
          metric,
          results.filter((record) => record.metrics[metric].ok).length,
        ]),
      ) as Record<PredictionMetric, number>,
      missingMeasuredCoefficientByMetric: Object.fromEntries(
        predictionMetricOrder.map((metric) => [
          metric,
          results.filter((record) => {
            const result = record.metrics[metric];
            return !result.ok && result.reason === "MEASURED_COEFFICIENT_NOT_FOUND";
          }).length,
        ]),
      ) as Record<PredictionMetric, number>,
    },
  };
};
