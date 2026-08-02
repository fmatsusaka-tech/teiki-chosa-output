import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dataSource: { readTab: vi.fn() },
  dataSourceConstructor: vi.fn(),
  repository: { getAll: vi.fn() },
  repositoryConstructor: vi.fn(),
}));

vi.mock("./google-sheets-api-analysis-data-source", () => ({
  GoogleSheetsApiAnalysisDataSource: mocks.dataSourceConstructor,
}));

vi.mock("../../repositories/analysis-data-repository", () => ({
  AnalysisDataRepository: mocks.repositoryConstructor,
}));

import { createAuthenticatedAnalysisDataRepository } from "./authenticated-analysis-data-repository";

describe("createAuthenticatedAnalysisDataRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dataSourceConstructor.mockReturnValue(mocks.dataSource);
    mocks.repositoryConstructor.mockReturnValue(mocks.repository);
  });

  it("creates the page repository with only the authenticated Sheets data source", () => {
    const repository = createAuthenticatedAnalysisDataRepository();

    expect(mocks.dataSourceConstructor).toHaveBeenCalledOnce();
    expect(mocks.repositoryConstructor).toHaveBeenCalledWith(mocks.dataSource);
    expect(repository).toBe(mocks.repository);
  });
});
