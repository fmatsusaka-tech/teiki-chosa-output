import type { AnalysisDataRecord } from "../../contracts/analysis-data";

export const orchardMasterSpreadsheetTitle = "定期調査Output園地マスタ";
export const orchardNameMasterSheetTitle = "園地名正規化マスタ";
export const orchardNameMasterRange = "A:K";

export const orchardNameMasterHeaders = [
  "原園地名", "正規化比較値", "正式園地名候補", "処理区候補", "適用ルール", "同一候補グループ",
  "確信度", "確認状態", "確認後正式園地名", "確認後処理区", "備考",
] as const;

export type OrchardMappingStatus = "確認済み" | "未確認" | "保留" | "統合しない";

export type OrchardNameMapping = {
  originalOrchard: string;
  officialOrchard: string;
  treatment: string | null;
  status: OrchardMappingStatus;
  precipitationStation: string | null;
  temperatureStation: string | null;
};

export type NormalizedAnalysisDataRecord = AnalysisDataRecord & {
  originalOrchard: string | null;
};

export class OrchardNameMasterContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrchardNameMasterContractError";
  }
}

const asText = (value: unknown, row: number, header: string): string => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new OrchardNameMasterContractError(`${row}行目の${header}が文字列ではありません。`);
  return value.trim();
};

export const decodeOrchardNameMaster = (values: readonly (readonly unknown[])[]): OrchardNameMapping[] => {
  if (values.length < 2) throw new OrchardNameMasterContractError("園地名正規化マスタが空です。");
  const header = values[0].map((value) => asText(value, 1, "見出し"));
  if (header.length !== orchardNameMasterHeaders.length || header.some((value, index) => value !== orchardNameMasterHeaders[index])) {
    throw new OrchardNameMasterContractError("園地名正規化マスタの見出しが正式契約と一致しません。");
  }
  const seen = new Set<string>();
  return values.slice(1).flatMap((row, index): OrchardNameMapping[] => {
    const rowNumber = index + 2;
    if (row.every((value) => value === undefined || value === null || value === "")) return [];
    const originalOrchard = asText(row[0], rowNumber, "原園地名");
    if (!originalOrchard) throw new OrchardNameMasterContractError(`${rowNumber}行目の原園地名が空です。`);
    if (seen.has(originalOrchard)) throw new OrchardNameMasterContractError(`${rowNumber}行目の原園地名が重複しています。`);
    seen.add(originalOrchard);
    const status = asText(row[7], rowNumber, "確認状態") as OrchardMappingStatus;
    if (!["確認済み", "未確認", "保留", "統合しない"].includes(status)) {
      throw new OrchardNameMasterContractError(`${rowNumber}行目の確認状態が不正です。`);
    }
    const confirmedOfficial = asText(row[8], rowNumber, "確認後正式園地名");
    const candidateOfficial = asText(row[2], rowNumber, "正式園地名候補");
    const confirmedTreatment = asText(row[9], rowNumber, "確認後処理区");
    const candidateTreatment = asText(row[3], rowNumber, "処理区候補");
    const officialOrchard = status === "確認済み" ? confirmedOfficial || candidateOfficial : originalOrchard;
    if (!officialOrchard) throw new OrchardNameMasterContractError(`${rowNumber}行目の正式園地名が空です。`);
    return [{
      originalOrchard,
      officialOrchard,
      treatment: status === "確認済み" ? confirmedTreatment || candidateTreatment || null : null,
      status,
      precipitationStation: null,
      temperatureStation: null,
    }];
  });
};

export const applyOrchardNameMaster = (
  records: readonly AnalysisDataRecord[],
  mappings: readonly OrchardNameMapping[],
): NormalizedAnalysisDataRecord[] => {
  const index = new Map(mappings.map((mapping) => [mapping.originalOrchard, mapping] as const));
  return records.map((record) => {
    const mapping = record.orchard ? index.get(record.orchard) : undefined;
    const useMapping = mapping?.status === "確認済み";
    return {
      ...record,
      originalOrchard: record.orchard,
      orchard: useMapping ? mapping.officialOrchard : record.orchard,
      treatment: useMapping ? mapping.treatment : record.treatment,
    };
  });
};
