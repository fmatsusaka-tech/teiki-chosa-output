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
