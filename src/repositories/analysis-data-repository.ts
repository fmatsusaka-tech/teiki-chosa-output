import {
  analysisDataHeaders,
  type AnalysisDataRecord,
  isEnabledAnalysisRecord,
  isIncludedInAnalysis,
  type AnalysisInclusionOptions,
} from "../contracts/analysis-data";
import { AnalysisDataError } from "./analysis-data-error";
import { resolveSheetsCalendarDate } from "./sheets-calendar-date";

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
      throw new AnalysisDataError("INVALID_RESPONSE", "調査データタブが存在しません。");
    }

    const [headers, ...dataRows] = rows;
    if (!headers) {
      throw new AnalysisDataError("MISSING_HEADERS", "調査データタブに見出し行がありません。");
    }
    if (dataRows.length === 0) {
      throw new AnalysisDataError("INVALID_RESPONSE", "調査データタブにデータ行がありません。");
    }

    const headerIndexes = this.resolveHeaderIndexes(headers);
    const records: AnalysisDataRecord[] = [];
    let firstError: Error | null = null;
    let skippedCount = 0;
    dataRows.forEach((row, index) => {
      try {
        records.push(this.toRecord(row, headerIndexes, index + 2));
      } catch (error) {
        skippedCount += 1;
        firstError ??= error instanceof Error ? error : new Error(String(error));
        console.error("調査データの行を読み飛ばしました。", error);
      }
    });

    if (records.length === 0) {
      throw firstError ?? new AnalysisDataError("INVALID_RESPONSE", "調査データタブの行を読み込めませんでした。");
    }
    if (skippedCount > 0) {
      console.error(`調査データの${skippedCount}行を不正な値のため読み飛ばしました。`);
    }
    return records;
  }

  async getStandardRecords(options?: AnalysisInclusionOptions): Promise<AnalysisDataRecord[]> {
    const records = await this.getAll();
    return records.filter((record) => isIncludedInAnalysis(record, options));
  }

  async getEnabledRecords(): Promise<AnalysisDataRecord[]> {
    const records = await this.getAll();
    return records.filter(isEnabledAnalysisRecord);
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
      throw new AnalysisDataError(
        "MISSING_HEADERS",
        `調査データタブに必須見出しがありません: ${missing.join("、")}`,
      );
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
      registeredAt: this.optionalRegisteredAt(value(analysisDataHeaders.registeredAt), analysisDataHeaders.registeredAt, rowNumber),
      measuredAt: this.optionalMeasuredAt(value(analysisDataHeaders.measuredAt), rowNumber),
      fiscalYear: this.requiredNumber(value(analysisDataHeaders.fiscalYear), analysisDataHeaders.fiscalYear, rowNumber),
      year: this.requiredNumber(value(analysisDataHeaders.year), analysisDataHeaders.year, rowNumber),
      month: this.requiredNumber(value(analysisDataHeaders.month), analysisDataHeaders.month, rowNumber),
      surveyMonth: this.requiredString(value(analysisDataHeaders.surveyMonth), analysisDataHeaders.surveyMonth, rowNumber),
      surveyPeriod: this.requiredString(value(analysisDataHeaders.surveyPeriod), analysisDataHeaders.surveyPeriod, rowNumber),
      orchard: this.optionalString(value(analysisDataHeaders.orchard), analysisDataHeaders.orchard, rowNumber),
      variety: this.optionalString(value(analysisDataHeaders.variety), analysisDataHeaders.variety, rowNumber),
      treatment: this.optionalString(value(analysisDataHeaders.treatment), analysisDataHeaders.treatment, rowNumber),
      notes: this.optionalString(value(analysisDataHeaders.notes), analysisDataHeaders.notes, rowNumber),
      diameterCount: this.optionalNumber(value(analysisDataHeaders.diameterCount), analysisDataHeaders.diameterCount, rowNumber),
      averageDiameter: this.optionalDiameter(value(analysisDataHeaders.averageDiameter), analysisDataHeaders.averageDiameter, rowNumber),
      minimumDiameter: this.optionalDiameter(value(analysisDataHeaders.minimumDiameter), analysisDataHeaders.minimumDiameter, rowNumber),
      maximumDiameter: this.optionalDiameter(value(analysisDataHeaders.maximumDiameter), analysisDataHeaders.maximumDiameter, rowNumber),
      brix: this.optionalNumber(value(analysisDataHeaders.brix), analysisDataHeaders.brix, rowNumber),
      acidity: this.optionalNumber(value(analysisDataHeaders.acidity), analysisDataHeaders.acidity, rowNumber),
      brixAcidityRatio: this.optionalNumber(value(analysisDataHeaders.brixAcidityRatio), analysisDataHeaders.brixAcidityRatio, rowNumber),
      dataStatus: this.requiredString(value(analysisDataHeaders.dataStatus), analysisDataHeaders.dataStatus, rowNumber),
      activationStatus: this.optionalString(value(analysisDataHeaders.activationStatus), analysisDataHeaders.activationStatus, rowNumber),
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
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (typeof value !== "string") {
      throw new Error(`調査データ ${rowNumber}行目の「${header}」を文字列へ変換できません。`);
    }
    return value.trim() || null;
  }

  private optionalRegisteredAt(value: unknown, header: string, rowNumber: number): string | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    if (typeof value === "string" && !value.trim()) {
      return null;
    }
    return resolveSheetsCalendarDate(
      value,
      { trimBeforeMatching: true, allowFractionalSerial: true, requireNonNegativeSerial: true, validateIsoDatePrefix: true },
      () => { throw this.invalidRegisteredAt(header, rowNumber); },
    );
  }

  private invalidRegisteredAt(header: string, rowNumber: number): Error {
    return new Error(`調査データ ${rowNumber}行目の「${header}」を有効な暦日へ変換できません。`);
  }

  private optionalMeasuredAt(value: unknown, rowNumber: number): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && !value.trim()) return null;
    return resolveSheetsCalendarDate(
      value,
      { trimBeforeMatching: false, allowFractionalSerial: false, requireNonNegativeSerial: false, validateIsoDatePrefix: false },
      () => { throw this.invalidMeasuredAt(rowNumber); },
    );
  }

  private invalidMeasuredAt(rowNumber: number): AnalysisDataError {
    return new AnalysisDataError(
      "INVALID_MEASURED_AT",
      `調査データ ${rowNumber}行目の「計測日」を有効な暦日へ変換できません。`,
    );
  }

  private requiredNumber(value: unknown, header: string, rowNumber: number): number {
    const parsed = this.optionalNumber(value, header, rowNumber);
    if (parsed === null) {
      throw new AnalysisDataError(
        "INVALID_NUMBER",
        `調査データ ${rowNumber}行目の「${header}」を数値へ変換できません。`,
      );
    }
    return parsed;
  }

  private optionalNumber(value: unknown, header: string, rowNumber: number): number | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    if (typeof value !== "number" && typeof value !== "string") {
      throw new AnalysisDataError(
        "INVALID_NUMBER",
        `調査データ ${rowNumber}行目の「${header}」を数値へ変換できません。`,
      );
    }
    if (typeof value === "string" && value.trim() === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      throw new AnalysisDataError(
        "INVALID_NUMBER",
        `調査データ ${rowNumber}行目の「${header}」を数値へ変換できません。`,
      );
    }
    return parsed;
  }

  private optionalDiameter(value: unknown, header: string, rowNumber: number): number | null {
    const parsed = this.optionalNumber(value, header, rowNumber);
    if (parsed === null) return null;

    // Legacy Input rows sometimes store one-decimal diameters without the decimal point.
    // Normalize only the three diameter measurement columns in the Output DTO.
    return parsed >= 100 && parsed < 1000 ? parsed / 10 : parsed;
  }
}
