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
  registeredAt: string;
  measuredAt: string;
  fiscalYear: number;
  year: number;
  month: number;
  surveyMonth: string;
  surveyPeriod: string;
  orchard: string;
  variety: string;
  treatment: string | null;
  notes: string | null;
  diameterCount: number;
  averageDiameter: number;
  minimumDiameter: number;
  maximumDiameter: number;
  brix: number | null;
  acidity: number | null;
  brixAcidityRatio: number | null;
  dataStatus: string;
  inputMethod: string;
  enteredBy: string | null;
  source: string | null;
}

/** 通常の分析・予測へ含めるデータ状態。 */
export const isIncludedInStandardAnalysis = (
  record: Pick<AnalysisDataRecord, "dataStatus">,
): boolean => record.dataStatus === "正常";
