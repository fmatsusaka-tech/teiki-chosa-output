import { createAuthenticatedAnalysisDataRepository } from "../../server/analysis-data/authenticated-analysis-data-repository";
import { loadDataManagementPageData } from "../../server/analysis-data/data-management-page-data";
import { DataManagementClient } from "./data-management-client";

export const dynamic = "force-dynamic";

const getPageData = async () => loadDataManagementPageData({
  loadRecords: () => createAuthenticatedAnalysisDataRepository().getAll(),
});

export default async function DataManagementPage() {
  const { inventory, visibilitySummary, dataError } = await getPageData();
  return <DataManagementClient dataError={dataError} inventory={inventory} visibilitySummary={visibilitySummary} />;
}
