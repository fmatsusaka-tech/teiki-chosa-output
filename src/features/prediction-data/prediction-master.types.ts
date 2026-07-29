export type PredictionMetric = "横径" | "糖度" | "クエン酸";

export type SheetCell = {
  formattedValue?: string;
  effectiveValue?: {
    numberValue?: number;
    stringValue?: string;
    boolValue?: boolean;
  };
};

export type PredictionModelMaster = {
  displayCategory: string;
  predictionModel: string;
  targetMonthDay: string;
  active: true;
  selectionCriteria: string;
  sourceYears: string;
  dataVersion: string;
  generatedAt: string;
};

export type PredictionCoefficientMaster = {
  metric: PredictionMetric;
  predictionModel: string;
  monthDay: string;
  coefficient: number;
  sourceSheet: string;
  sourceCell: string;
  dataVersion: string;
  generatedAt: string;
};

export type PredictionMasterBundle = {
  models: PredictionModelMaster[];
  coefficients: PredictionCoefficientMaster[];
};

export type LegacyPredictionSheet = {
  title: string;
  grid: SheetCell[][];
};
