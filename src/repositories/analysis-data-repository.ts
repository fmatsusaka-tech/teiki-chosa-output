import {
  analysisDataHeaders,
  type AnalysisDataRecord,
  isIncludedInAnalysis,
  type AnalysisInclusionOptions,
} from "../contracts/analysis-data";
import { AnalysisDataError } from "./analysis-data-error";

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
    return dataRows.map((row, index) => this.toRecord(row, headerIndexes, index + 2));
  }

  async getStandardRecords(options?: AnalysisInclusionOptions): Promise<AnalysisDataRecord[]> {
    const records = await this.getAll();
    return records.filter((record) => isIncludedInAnalysis(record, options));
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
      averageDiameter: this.optionalNumber(value(analysisDataHeaders.averageDiameter), analysisDataHeaders.averageDiameter, rowNumber),
      minimumDiameter: this.optionalNumber(value(analysisDataHeaders.minimumDiameter), analysisDataHeaders.minimumDiameter, rowNumber),
      maximumDiameter: this.optionalNumber(value(analysisDataHeaders.maximumDiameter), analysisDataHeaders.maximumDiameter, rowNumber),
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

  private optionalRegisteredAt(value: unknown, header: string, rowNumber: number): string | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    if (typeof value === "string") {
      return value.trim() || null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      const milliseconds = Date.UTC(1899, 11, 30) + value * 86_400_000;
      const date = new Date(milliseconds);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    throw new Error(`調査データ ${rowNumber}行目の「${header}」を日付へ変換できません。`);
  }

  private optionalMeasuredAt(value: unknown, rowNumber: number): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
      if (!value.trim()) return null;

      const gviz = /^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/.exec(value);
      if (gviz) {
        return this.calendarDate(
          Number(gviz[1]),
          Number(gviz[2]) + 1,
          Number(gviz[3]),
          rowNumber,
        );
      }

      const calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
        ?? /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value);
      if (calendar) {
        return this.calendarDate(
          Number(calendar[1]),
          Number(calendar[2]),
          Number(calendar[3]),
          rowNumber,
        );
      }

      const zoned = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
      if (zoned) {
        this.calendarDate(Number(zoned[1]), Number(zoned[2]), Number(zoned[3]), rowNumber);
        const hour = Number(zoned[4]);
        const minute = Number(zoned[5]);
        const second = Number(zoned[6] ?? "0");
        const offset = zoned[8];
        const offsetHour = offset === "Z" ? 0 : Number(offset.slice(1, 3));
        const offsetMinute = offset === "Z" ? 0 : Number(offset.slice(4, 6));
        if (
          hour > 23 || minute > 59 || second > 59 ||
          offsetHour > 14 || offsetMinute > 59 ||
          (offsetHour === 14 && offsetMinute !== 0)
        ) {
          throw this.invalidMeasuredAt(rowNumber);
        }
        const instant = new Date(value);
        if (Number.isNaN(instant.getTime())) throw this.invalidMeasuredAt(rowNumber);
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Tokyo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(instant);
        const part = (type: Intl.DateTimeFormatPartTypes): string =>
          parts.find((item) => item.type === type)?.value ?? "";
        return `${part("year")}-${part("month")}-${part("day")}`;
      }
      throw this.invalidMeasuredAt(rowNumber);
    }

    if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) {
      const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
    throw this.invalidMeasuredAt(rowNumber);
  }

  private calendarDate(year: number, month: number, day: number, rowNumber: number): string {
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw this.invalidMeasuredAt(rowNumber);
    }
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
}
