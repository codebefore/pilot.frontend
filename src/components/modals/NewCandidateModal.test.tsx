import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { NewCandidateModal } from "./NewCandidateModal";

const createCandidateMock = vi.fn();
const assignCandidateGroupMock = vi.fn();
const getCandidateReuseSourcesMock = vi.fn();
const getCertificateProgramsMock = vi.fn();
const getLicenseClassDefinitionsMock = vi.fn();
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

vi.mock("../../lib/certificate-programs-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/certificate-programs-api")>(
    "../../lib/certificate-programs-api"
  );
  return {
    ...actual,
    getCertificatePrograms: (...args: Parameters<typeof actual.getCertificatePrograms>) =>
      getCertificateProgramsMock(...args),
  };
});

vi.mock("../../lib/license-class-definitions-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/license-class-definitions-api")>(
    "../../lib/license-class-definitions-api"
  );
  return {
    ...actual,
    getLicenseClassDefinitions: (
      ...args: Parameters<typeof actual.getLicenseClassDefinitions>
    ) => getLicenseClassDefinitionsMock(...args),
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

const licenseClassDefinition = (code: string, displayOrder: number) => ({
  id: `license-${code}`,
  code,
  name: code,
  category: "automobile" as const,
  minimumAge: 18,
  hasExistingLicense: false,
  existingLicenseType: null,
  existingLicensePre2016: false,
  requiresTheoryExam: true,
  requiresPracticeExam: true,
  theoryLessonHours: 34,
  simulatorLessonHours: 0,
  directPracticeLessonHours: 14,
  displayOrder,
  isActive: true,
  notes: null,
  createdAtUtc: "2026-05-03T00:00:00Z",
  updatedAtUtc: "2026-05-03T00:00:00Z",
  rowVersion: 1,
});

const certificateProgram = (
  id: string,
  sourceLicenseClass: string,
  targetLicenseClass: string,
  displayOrder: number
) => ({
  id,
  code: `${sourceLicenseClass}-${targetLicenseClass}`,
  sourceLicenseClass,
  sourceLicenseDisplayName: sourceLicenseClass === "YOK" ? "Yok" : sourceLicenseClass,
  sourceLicensePre2016: false,
  targetLicenseClass,
  targetLicenseDisplayName: targetLicenseClass,
  minimumAge: 18,
  theoryLessonHours: 34,
  practiceLessonHours: 14,
  displayOrder,
  isActive: true,
  notes: null,
  createdAtUtc: "2026-05-03T00:00:00Z",
  updatedAtUtc: "2026-05-03T00:00:00Z",
  rowVersion: 1,
});

describe("NewCandidateModal", () => {
  beforeEach(() => {
    createCandidateMock.mockReset();
    assignCandidateGroupMock.mockReset();
    getCandidateReuseSourcesMock.mockReset();
    getCertificateProgramsMock.mockReset();
    getLicenseClassDefinitionsMock.mockReset();
    getGroupsMock.mockReset();
    getTermsMock.mockReset();

    createCandidateMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "10000000146",
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
    getCertificateProgramsMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 1000,
      totalCount: 0,
      totalPages: 0,
      summary: { activeCount: 0, inactiveCount: 0 },
    });

    getLicenseClassDefinitionsMock.mockImplementation((options) => {
      const items = [
        licenseClassDefinition("A2", 20),
        licenseClassDefinition("B", 30),
        licenseClassDefinition("B-OTOMATIK", 40),
      ];

      return Promise.resolve({
        items: options?.activity === "active" ? items : items,
        page: 1,
        pageSize: options?.pageSize ?? 1000,
        totalCount: items.length,
        totalPages: 1,
        summary: { activeCount: items.length },
      });
    });

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
      target: { value: "10000000146" },
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

    await waitFor(() => {
      const select = document.querySelector<HTMLSelectElement>('select[name="className"]');
      expect([...select!.options].map((option) => option.value)).toContain("B");
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
        expect(createCandidateMock).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: "Ada",
            lastName: "Yilmaz",
            nationalId: "10000000146",
            // birthDate, gender, email are no longer collected at quick
            // registration — they are edited from the candidate detail page.
            birthDate: null,
            gender: null,
            email: null,
            licenseClass: "B",
            status: "pre_registered",
          })
      );
    });
  });

  it("rejects invalid Turkish national IDs before submit", async () => {
    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    fireEvent.change(screen.getByPlaceholderText("11 haneli TC"), {
      target: { value: "12345678901" },
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

    expect(await screen.findByText("Geçerli bir TC kimlik no girin")).toBeInTheDocument();
    expect(createCandidateMock).not.toHaveBeenCalled();
  });

  it("lists target license classes from certificate programs", async () => {
    getCertificateProgramsMock.mockResolvedValue({
      items: [
        {
          id: "program-1",
          code: "YOK-A2",
          sourceLicenseClass: "YOK",
          sourceLicenseDisplayName: "Yok",
          sourceLicensePre2016: false,
          targetLicenseClass: "A2",
          targetLicenseDisplayName: "A2",
          minimumAge: 18,
          theoryLessonHours: 34,
          practiceLessonHours: 6,
          displayOrder: 20,
          isActive: true,
          notes: null,
          createdAtUtc: "2026-05-03T00:00:00Z",
          updatedAtUtc: "2026-05-03T00:00:00Z",
          rowVersion: 1,
        },
        {
          id: "program-2",
          code: "YOK-B-OTOMATIK",
          sourceLicenseClass: "YOK",
          sourceLicenseDisplayName: "Yok",
          sourceLicensePre2016: false,
          targetLicenseClass: "B - OTOMATİK",
          targetLicenseDisplayName: "B - Otomatik",
          minimumAge: 18,
          theoryLessonHours: 34,
          practiceLessonHours: 14,
          displayOrder: 40,
          isActive: true,
          notes: null,
          createdAtUtc: "2026-05-03T00:00:00Z",
          updatedAtUtc: "2026-05-03T00:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 1000,
      totalCount: 2,
      totalPages: 1,
      summary: { activeCount: 2, inactiveCount: 0 },
    });

    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    await waitFor(() => {
      const select = document.querySelector<HTMLSelectElement>('select[name="className"]');
      expect(select).not.toBeNull();
      expect([...select!.options].map((option) => option.value)).toEqual([
        "A2",
        "B-OTOMATIK",
      ]);
    });
  });

  it("submits the default no-existing-license certificate program for the selected class", async () => {
    getCertificateProgramsMock.mockResolvedValue({
      items: [
        certificateProgram("program-b", "YOK", "B", 30),
        certificateProgram("program-a2", "YOK", "A2", 20),
        certificateProgram("program-b-from-a2", "A2", "B", 10),
      ],
      page: 1,
      pageSize: 1000,
      totalCount: 3,
      totalPages: 1,
      summary: { activeCount: 3, inactiveCount: 0 },
    });

    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    await waitFor(() => {
      const select = document.querySelector<HTMLSelectElement>('select[name="className"]');
      expect(select).not.toBeNull();
      expect([...select!.options].map((option) => option.value)).toContain("B");
    });

    fireEvent.change(screen.getByPlaceholderText("11 haneli TC"), {
      target: { value: "10000000146" },
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
          licenseClass: "B",
          certificateProgramId: "program-b",
          existingLicenseType: null,
          existingLicensePre2016: false,
        })
      );
    });
  });

  it("does not list certificate program targets without an active license class", async () => {
    getCertificateProgramsMock.mockResolvedValue({
      items: [
        {
          id: "program-1",
          code: "YOK-A2",
          sourceLicenseClass: "YOK",
          sourceLicenseDisplayName: "Yok",
          sourceLicensePre2016: false,
          targetLicenseClass: "A2",
          targetLicenseDisplayName: "A2",
          minimumAge: 18,
          theoryLessonHours: 34,
          practiceLessonHours: 6,
          displayOrder: 20,
          isActive: true,
          notes: null,
          createdAtUtc: "2026-05-03T00:00:00Z",
          updatedAtUtc: "2026-05-03T00:00:00Z",
          rowVersion: 1,
        },
        {
          id: "program-2",
          code: "YOK-B",
          sourceLicenseClass: "YOK",
          sourceLicenseDisplayName: "Yok",
          sourceLicensePre2016: false,
          targetLicenseClass: "B",
          targetLicenseDisplayName: "B",
          minimumAge: 18,
          theoryLessonHours: 34,
          practiceLessonHours: 14,
          displayOrder: 30,
          isActive: true,
          notes: null,
          createdAtUtc: "2026-05-03T00:00:00Z",
          updatedAtUtc: "2026-05-03T00:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 1000,
      totalCount: 2,
      totalPages: 1,
      summary: { activeCount: 2, inactiveCount: 0 },
    });
    getLicenseClassDefinitionsMock.mockImplementation((options) => {
      const activeItems = [licenseClassDefinition("A2", 20)];
      const allItems = [...activeItems, { ...licenseClassDefinition("B", 30), isActive: false }];

      return Promise.resolve({
        items: options?.activity === "active" ? activeItems : allItems,
        page: 1,
        pageSize: options?.pageSize ?? 1000,
        totalCount: options?.activity === "active" ? activeItems.length : allItems.length,
        totalPages: 1,
        summary: { activeCount: activeItems.length },
      });
    });

    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    await waitFor(() => {
      const select = document.querySelector<HTMLSelectElement>('select[name="className"]');
      expect(select).not.toBeNull();
      expect([...select!.options].map((option) => option.value)).toEqual(["A2"]);
    });
  });

  it("can prefill identity fields and copy selected documents from a reuse source", async () => {
    getCandidateReuseSourcesMock.mockResolvedValue([
      {
        id: "source-1",
        firstName: "Ayse",
        lastName: "Demir",
        nationalId: "10000000146",
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
      target: { value: "10000000146" },
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
          // Birth date, gender, email and existing license info are no longer
          // copied from a reuse source — they are edited from the candidate
          // detail page.
          birthDate: null,
          gender: null,
          email: null,
          existingLicenseType: null,
          existingLicenseIssuedAt: null,
          existingLicenseNumber: null,
          existingLicenseIssuedProvince: null,
          existingLicensePre2016: false,
          reuseFromCandidateId: "source-1",
          documentIdsToCopy: ["document-1"],
        })
      );
    });
  });
});
