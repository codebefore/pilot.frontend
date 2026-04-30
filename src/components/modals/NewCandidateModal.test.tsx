import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { NewCandidateModal } from "./NewCandidateModal";

const createCandidateMock = vi.fn();
const assignCandidateGroupMock = vi.fn();
const getCandidateReuseSourcesMock = vi.fn();
const getGroupsMock = vi.fn();
const getTermsMock = vi.fn();

vi.mock("../../lib/candidates-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/candidates-api")>(
    "../../lib/candidates-api"
  );
  return {
    ...actual,
    createCandidate: (...args: Parameters<typeof actual.createCandidate>) =>
      createCandidateMock(...args),
    assignCandidateGroup: (...args: Parameters<typeof actual.assignCandidateGroup>) =>
      assignCandidateGroupMock(...args),
    getCandidateReuseSources: (
      ...args: Parameters<typeof actual.getCandidateReuseSources>
    ) => getCandidateReuseSourcesMock(...args),
  };
});

vi.mock("../../lib/groups-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/groups-api")>(
    "../../lib/groups-api"
  );
  return {
    ...actual,
    getGroups: (...args: Parameters<typeof actual.getGroups>) => getGroupsMock(...args),
  };
});

vi.mock("../../lib/terms-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/terms-api")>(
    "../../lib/terms-api"
  );
  return {
    ...actual,
    getTerms: (...args: Parameters<typeof actual.getTerms>) => getTermsMock(...args),
  };
});

describe("NewCandidateModal", () => {
  beforeEach(() => {
    createCandidateMock.mockReset();
    assignCandidateGroupMock.mockReset();
    getCandidateReuseSourcesMock.mockReset();
    getGroupsMock.mockReset();
    getTermsMock.mockReset();

    createCandidateMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "11111111111",
      phoneNumber: null,
      email: null,
      birthDate: "2000-01-01",
      gender: null,
      licenseClass: "B",
      existingLicenseType: null,
      existingLicenseIssuedAt: null,
      existingLicenseNumber: null,
      existingLicenseIssuedProvince: null,
      existingLicensePre2016: false,
      status: "pre_registered",
      currentGroup: null,
      documentSummary: null,
      createdAtUtc: "2026-04-15T00:00:00Z",
      updatedAtUtc: "2026-04-15T00:00:00Z",
    });

    getCandidateReuseSourcesMock.mockResolvedValue([]);

    assignCandidateGroupMock.mockResolvedValue({
      assignmentId: "assignment-1",
      candidateId: "candidate-1",
      groupId: "group-1",
      groupTitle: "1A",
      groupStartDate: "2026-04-02",
      assignedAtUtc: "2026-04-15T00:00:00Z",
      removedAtUtc: null,
      isActive: true,
    });

    getGroupsMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      totalCount: 0,
      totalPages: 1,
    });

    getTermsMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 200,
      totalCount: 0,
      totalPages: 1,
    });
  });

  it("creates candidates with canonical default status pre_registered", async () => {
    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    fireEvent.change(screen.getByPlaceholderText("11 haneli TC"), {
      target: { value: "11111111111" },
    });
    fireEvent.change(screen.getByPlaceholderText("Adı"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Soyadı"), {
      target: { value: "Yilmaz" },
    });
    fireEvent.change(screen.getByPlaceholderText("5XXXXXXXXX"), {
      target: { value: "5551234567" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
        expect(createCandidateMock).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: "Ada",
            lastName: "Yilmaz",
            nationalId: "11111111111",
            gender: "male",
            licenseClass: "B",
            status: "pre_registered",
          })
        );
    });
  });

  it("allows overriding default gender before submit", async () => {
    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    fireEvent.change(screen.getByPlaceholderText("11 haneli TC"), {
      target: { value: "11111111111" },
    });
    fireEvent.change(screen.getByPlaceholderText("Adı"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Soyadı"), {
      target: { value: "Yilmaz" },
    });
    fireEvent.change(screen.getByPlaceholderText("5XXXXXXXXX"), {
      target: { value: "5551234567" },
    });
    const genderSelect = document.querySelector('select[name="gender"]');
    expect(genderSelect).not.toBeNull();
    fireEvent.change(genderSelect!, {
      target: { value: "female" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createCandidateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          gender: "female",
        })
      );
    });
  });

  it("includes existing license fields when the toggle is enabled", async () => {
    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    fireEvent.change(screen.getByPlaceholderText("11 haneli TC"), {
      target: { value: "11111111111" },
    });
    fireEvent.change(screen.getByPlaceholderText("Adı"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Soyadı"), {
      target: { value: "Yilmaz" },
    });
    fireEvent.change(screen.getByPlaceholderText("5XXXXXXXXX"), {
      target: { value: "5551234567" },
    });

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Mevcut sürücü belgesi var" })
    );
    await screen.findByLabelText("Mevcut Belge");
    fireEvent.change(screen.getByLabelText("Mevcut Belge"), {
      target: { value: "b_auto" },
    });
    const existingLicenseIssuedAtInput = document.querySelector(
      'input[name="existingLicenseIssuedAt"]'
    );
    expect(existingLicenseIssuedAtInput).not.toBeNull();
    fireEvent.change(existingLicenseIssuedAtInput!, {
      target: { value: "2018-03-04" },
    });
    fireEvent.change(screen.getByLabelText("Belge No"), {
      target: { value: " 12345 " },
    });
    fireEvent.change(screen.getByLabelText("Belge Veriliş İli"), {
      target: { value: "Ankara" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "2016 Ocak öncesi" }));

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createCandidateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          existingLicenseType: "b_auto",
          existingLicenseIssuedAt: "2018-03-04",
          existingLicenseNumber: "12345",
          existingLicenseIssuedProvince: "Ankara",
          existingLicensePre2016: true,
        })
      );
    });
  });

  it("can prefill identity fields and copy selected documents from a reuse source", async () => {
    getCandidateReuseSourcesMock.mockResolvedValue([
      {
        id: "source-1",
        firstName: "Ayse",
        lastName: "Demir",
        nationalId: "11111111111",
        phoneNumber: "5557654321",
        email: "ayse@example.com",
        birthDate: "1998-02-03",
        gender: "female",
        licenseClass: "B",
        existingLicenseType: "b",
        existingLicenseIssuedAt: "2020-05-06",
        existingLicenseNumber: "B-12345",
        existingLicenseIssuedProvince: "Ankara",
        existingLicensePre2016: true,
        status: "graduated",
        createdAtUtc: "2026-01-01T00:00:00Z",
        documents: [
          {
            id: "photo-document-1",
            documentTypeId: "photo-document-type-1",
            documentTypeKey: "biometric_photo",
            documentTypeName: "Biometrik Fotoğraf",
            originalFileName: "foto.jpg",
            isPhysicallyAvailable: false,
            hasFile: true,
            note: null,
            uploadedAtUtc: "2026-01-01T00:00:00Z",
          },
          {
            id: "document-1",
            documentTypeId: "document-type-1",
            documentTypeKey: "identity",
            documentTypeName: "Kimlik",
            originalFileName: "kimlik.pdf",
            isPhysicallyAvailable: false,
            hasFile: true,
            note: null,
            uploadedAtUtc: "2026-01-02T00:00:00Z",
          },
        ],
      },
    ]);

    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    fireEvent.change(screen.getByPlaceholderText("11 haneli TC"), {
      target: { value: "11111111111" },
    });

    await screen.findByText(/Ayse Demir/);
    expect(await screen.findByAltText("Ayse Demir")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Ayse Demir eski başvuru/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Kimlik/ }));

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createCandidateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Ayse",
          lastName: "Demir",
          phoneNumber: "5557654321",
          email: "ayse@example.com",
          gender: "female",
          existingLicenseType: "b",
          existingLicenseIssuedAt: "2020-05-06",
          existingLicenseNumber: "B-12345",
          existingLicenseIssuedProvince: "Ankara",
          existingLicensePre2016: true,
          reuseFromCandidateId: "source-1",
          documentIdsToCopy: ["document-1"],
        })
      );
    });
  });
});
