import { AnalysisDataRepository } from "../../repositories/analysis-data-repository";
import { GoogleSheetsApiAnalysisDataSource } from "./google-sheets-api-analysis-data-source";

/** Creates the server-only, read-only repository used by analysis pages. */
export const createAuthenticatedAnalysisDataRepository = (): AnalysisDataRepository =>
  new AnalysisDataRepository(new GoogleSheetsApiAnalysisDataSource());
