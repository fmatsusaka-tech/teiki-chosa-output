import {
  analysisDataHeaders,
  type AnalysisDataRecord,
  isIncludedInStandardAnalysis,
} from "../contracts/analysis-data";

const analysisDataTabName = "調査データ";
const requiredHeaders = Object.values(analysisDataHeaders);

export interface AnalysisDataTableSource {
  readTab(tabName: typeof analysisDataTabName): Promise<readonly (readonly unknown[])[] | null>;
}

export class AnalysisDataRepository {
  constructor(private readonly source: AnalysisDataTableSource) {}

  async getAll(): Promise<AnalysisDataRecord[]> {
    const rows = await this.source.readTab(analysisDataTabName);

    if (rows === null) {
      throw new Error(`調査データタブが存在しません。`);
    }

    const [headers, ...dataRows] = rows;
    if (!headers) {
      throw new Error("調査データタブに見出し行がありません。");
    }
    if (dataRows.length === 0) {
      throw new Error("調査データタブにデータ行がありません。");
    }

    const headerIndexes = this.resolveHeaderIndexes(headers);
    return dataRows.map((row, index) => this.toRecord(row, headerIndexes, index + 2));
  }

  async getStandardRecords(): Promise<AnalysisDataRecord[]> {
    const records = await this.getAll();
    return records.filter(isIncludedInStandardAnalysis);
  }

  private resolveHeaderIndexes(headers: readonly unknown[]): Map<string, number> {
    const indexes = new Map<string, number>();

    headers.forEach((header, index) => {
      if (typeof header === "string") {
        indexes.set(header.trim(), index);
      }
    });

    const missing = requiredHeaders.filter((header) => !indexes.has(header));
    if (missing.length > 0) {
      throw new Error(`調査データタブに必須見出しがありません: ${missing.join("、")}`);
    }

    return indexes;
  }

  private toRecord(
    row: readonly unknown[],
    indexes: ReadonlyMap<string, number>,
    rowNumber: number,
  ): AnalysisDataRecord {
    const value = (header: string): unknown => row[indexes.get(header)!];

    return {
      id: this.requiredString(value(analysisDataHeaders.id), analysisDataHeaders.id, rowNumber),
      registeredAt: this.requiredString(value(analysisDataHeaders.registeredAt), analysisDataHeaders.registeredAt, rowNumber),
      measuredAt: this.requiredString(value(analysisDataHeaders.measuredAt), analysisDataHeaders.measuredAt, rowNumber),
      fiscalYear: this.requiredNumber(value(analysisDataHeaders.fiscalYear), analysisDataHeaders.fiscalYear, rowNumber),
      year: this.requiredNumber(value(analysisDataHeaders.year), analysisDataHeaders.year, rowNumber),
      month: this.requiredNumber(value(analysisDataHeaders.month), analysisDataHeaders.month, rowNumber),
      surveyMonth: this.requiredString(value(analysisDataHeaders.surveyMonth), analysisDataHeaders.surveyMonth, rowNumber),
      surveyPeriod: this.requiredString(value(analysisDataHeaders.surveyPeriod), analysisDataHeaders.surveyPeriod, rowNumber),
      orchard: this.requiredString(value(analysisDataHeaders.orchard), analysisDataHeaders.orchard, rowNumber),
      variety: this.requiredString(value(analysisDataHeaders.variety), analysisDataHeaders.variety, rowNumber),
      treatment: this.optionalString(value(analysisDataHeaders.treatment), analysisDataHeaders.treatment, rowNumber),
      notes: this.optionalString(value(analysisDataHeaders.notes), analysisDataHeaders.notes, rowNumber),
      diameterCount: this.requiredNumber(value(analysisDataHeaders.diameterCount), analysisDataHeaders.diameterCount, rowNumber),
      averageDiameter: this.requiredNumber(value(analysisDataHeaders.averageDiameter), analysisDataHeaders.averageDiameter, rowNumber),
      minimumDiameter: this.requiredNumber(value(analysisDataHeaders.minimumDiameter), analysisDataHeaders.minimumDiameter, rowNumber),
      maximumDiameter: this.requiredNumber(value(analysisDataHeaders.maximumDiameter), analysisDataHeaders.maximumDiameter, rowNumber),
      brix: this.optionalNumber(value(analysisDataHeaders.brix), analysisDataHeaders.brix, rowNumber),
      acidity: this.optionalNumber(value(analysisDataHeaders.acidity), analysisDataHeaders.acidity, rowNumber),
      brixAcidityRatio: this.optionalNumber(value(analysisDataHeaders.brixAcidityRatio), analysisDataHeaders.brixAcidityRatio, rowNumber),
      dataStatus: this.requiredString(value(analysisDataHeaders.dataStatus), analysisDataHeaders.dataStatus, rowNumber),
      inputMethod: this.requiredString(value(analysisDataHeaders.inputMethod), analysisDataHeaders.inputMethod, rowNumber),
      enteredBy: this.optionalString(value(analysisDataHeaders.enteredBy), analysisDataHeaders.enteredBy, rowNumber),
      source: this.optionalString(value(analysisDataHeaders.source), analysisDataHeaders.source, rowNumber),
    };
  }

  private requiredString(value: unknown, header: string, rowNumber: number): string {
    const parsed = this.optionalString(value, header, rowNumber);
    if (parsed === null) {
      throw new Error(`調査データ ${rowNumber}行目の「${header}」を文字列へ変換できません。`);
    }
    return parsed;
  }

  private optionalString(value: unknown, header: string, rowNumber: number): string | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    if (typeof value !== "string") {
      throw new Error(`調査データ ${rowNumber}行目の「${header}」を文字列へ変換できません。`);
    }
    return value.trim() || null;
  }

  private requiredNumber(value: unknown, header: string, rowNumber: number): number {
    const parsed = this.optionalNumber(value, header, rowNumber);
    if (parsed === null) {
      throw new Error(`調査データ ${rowNumber}行目の「${header}」を数値へ変換できません。`);
    }
    return parsed;
  }

  private optionalNumber(value: unknown, header: string, rowNumber: number): number | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`調査データ ${rowNumber}行目の「${header}」を数値へ変換できません。`);
    }
    return parsed;
  }
}
