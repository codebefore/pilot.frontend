import { beforeEach, describe, expect, it, vi } from "vitest";

import { listWenntecContactImportReviewItems } from "./wenntec-contact-import-api";

const httpGetMock = vi.fn();

vi.mock("./api", () => ({
  getCandidateApiBaseUrl: () => "https://candidates.test",
}));

vi.mock("./http", () => ({
  httpGet: (...args: unknown[]) => httpGetMock(...args),
  httpPost: vi.fn(),
  httpPostForm: vi.fn(),
}));

describe("wenntec contact import API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locally pages the legacy array response during a rolling deploy", async () => {
    httpGetMock.mockResolvedValue(Array.from({ length: 26 }, (_, index) => ({
      id: `item-${index + 1}`,
      maskedNationalId: "100*****240",
      phoneNumber: null,
      address: null,
      status: "candidate_not_found",
      reason: null,
      sourceRowCount: 1,
      matchedCandidateCount: 0,
      updatedCandidateCount: 0,
      variantsJson: "{}",
    })));

    const result = await listWenntecContactImportReviewItems("batch-1", "token", 2, 10);

    expect(result.total).toBe(26);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(3);
    expect(result.items).toHaveLength(10);
    expect(result.items[0]?.id).toBe("item-11");
  });
});
