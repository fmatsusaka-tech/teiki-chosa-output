export type AnalysisDataErrorCode =
  | "TAB_NOT_ALLOWED"
  | "FETCH_FAILED"
  | "RESPONSE_PARSE_FAILED"
  | "INVALID_RESPONSE"
  | "MISSING_HEADERS"
  | "INVALID_MEASURED_AT"
  | "INVALID_NUMBER";

export class AnalysisDataError extends Error {
  constructor(
    public readonly code: AnalysisDataErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AnalysisDataError";
  }
}
