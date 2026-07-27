import type { AnalysisDataRecord } from "../../contracts/analysis-data";
import { PeriodicAnalysisClient } from "./periodic-analysis-client";

const records: AnalysisDataRecord[] = [];

export default function AnalysisPage() {
  return <PeriodicAnalysisClient records={records} />;
}
