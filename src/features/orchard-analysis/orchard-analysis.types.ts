export type OrchardAnalysisQuery = {
  orchard: string;
  varietyCategory: string;
  treatment?: string | null;
};

export type OrchardAnalysisRow = {
  registrationId: string;
  measuredAt: string;
  treatment: string | null;
  diameterAverage: number | null;
  brix: number | null;
  acidity: number | null;
};

export type OrchardAnalysisTimelineEntry =
  | { type: "year"; year: number }
  | { type: "record"; row: OrchardAnalysisRow };

export type OrchardAnalysisFilterOptions = {
  orchards: string[];
  varietyCategories: string[];
  treatments: (string | null)[];
};

export type OrchardSelectionOption = {
  key: string;
  orchard: string;
  treatment: string | null;
  latestMeasuredAt: string | null;
  label: string;
};

export type OrchardComparisonSelection = OrchardAnalysisQuery;

export type OrchardComparisonMetric =
  | "averageDiameter"
  | "minimumDiameter"
  | "maximumDiameter"
  | "brix"
  | "acidity"
  | "brixAcidityRatio";

export type OrchardComparisonRecord = {
  registrationId: string;
  measuredAt: string;
  registeredAt: string | null;
  treatment: string | null;
  averageDiameter: number | null;
  minimumDiameter: number | null;
  maximumDiameter: number | null;
  brix: number | null;
  acidity: number | null;
  brixAcidityRatio: number | null;
};

export type OrchardComparisonColumn = {
  key: string;
  measuredAt: string;
  yearBoundary: boolean;
  orchardA: OrchardComparisonRecord | null;
  orchardB: OrchardComparisonRecord | null;
};

export type OrchardComparison = {
  columns: OrchardComparisonColumn[];
  latestA: OrchardComparisonRecord | null;
  latestB: OrchardComparisonRecord | null;
};
