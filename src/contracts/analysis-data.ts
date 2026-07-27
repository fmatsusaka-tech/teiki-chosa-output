/** `調査データ` タブの見出し名。列順には依存しない。 */
export const analysisDataHeaders = {
  id: "登録ID",
  registeredAt: "登録日時",
  measuredAt: "計測日",
  fiscalYear: "年度",
  year: "年",
  month: "月",
  surveyMonth: "調査基準月",
  surveyPeriod: "調査区分",
  orchard: "園地名",
  variety: "品種",
  treatment: "処理区",
  notes: "備考",
  diameterCount: "横径個数",
  averageDiameter: "横径平均",
  minimumDiameter: "横径最小",
  maximumDiameter: "横径最大",
  brix: "糖度",
  acidity: "酸度",
  brixAcidityRatio: "糖酸比",
  dataStatus: "データ状態",
  inputMethod: "入力方法",
  enteredBy: "入力者",
  source: "送信元",
} as const;

export type AnalysisDataHeader =
  (typeof analysisDataHeaders)[keyof typeof analysisDataHeaders];

/** `調査データ` から読取後に Output が利用するレコード。 */
export interface AnalysisDataRecord {
  id: string;
  registeredAt: string | null;
  measuredAt: string | null;
  fiscalYear: number;
  year: number;
  month: number;
  surveyMonth: string;
  surveyPeriod: string;
  orchard: string | null;
  variety: string | null;
  treatment: string | null;
  notes: string | null;
  diameterCount: number | null;
  averageDiameter: number | null;
  minimumDiameter: number | null;
  maximumDiameter: number | null;
  brix: number | null;
  acidity: number | null;
  brixAcidityRatio: number | null;
  dataStatus: string;
  inputMethod: string;
  enteredBy: string | null;
  source: string | null;
}

export type AnalysisInclusionOptions = { includeNeedsReview?: boolean };

const standardAnalysisStatuses = new Set(["正常", "横径なし", "糖度なし", "酸度なし"]);

/**
 * Output全体で使用する分析対象の判定。
 * 欠測はデータ状態であり、レコードを除外する理由にはしない。
 */
export const isIncludedInAnalysis = (
  record: Pick<AnalysisDataRecord, "dataStatus">,
  options: AnalysisInclusionOptions = {},
): boolean => standardAnalysisStatuses.has(record.dataStatus)
  || (options.includeNeedsReview === true && record.dataStatus === "要確認");

/** @deprecated `isIncludedInAnalysis` を使用する。 */
export const isIncludedInStandardAnalysis = (
  record: Pick<AnalysisDataRecord, "dataStatus">,
): boolean => isIncludedInAnalysis(record);
