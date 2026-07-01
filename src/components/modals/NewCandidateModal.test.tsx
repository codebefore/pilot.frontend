import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { NewCandidateModal } from "./NewCandidateModal";

const createCandidateMock = vi.fn();
const assignCandidateGroupMock = vi.fn();
const getCandidateReuseSourcesMock = vi.fn();
const getLicenseClassDefinitionsMock = vi.fn();
const getGroupsMock = vi.fn();
const getTermsMock = vi.fn();

vi.mock("../../lib/authorized-files", () => ({
  createAuthorizedObjectUrl: (url: string) => Promise.resolve(url),
  openAuthorizedFile: vi.fn(),
  downloadAuthorizedFile: vi.fn(),
  printAuthorizedFile: vi.fn(),
}));

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

const baseLicenseClassDefinition = (code: string, displayOrder: number) => ({
  id: `license-${code}`,
  code,
  name: code,
  minimumAge: 18,
  existingLicenseType: null as string | null,
  theoryLessonHours: 34,
  directPracticeLessonHours: 14,
  displayOrder,
  isActive: true,
  createdAtUtc: "2026-05-03T00:00:00Z",
  updatedAtUtc: "2026-05-03T00:00:00Z",
  rowVersion: 1,
});

const licenseClassDefinition = (
  code: string,
  displayOrder: number,
  overrides: Partial<ReturnType<typeof baseLicenseClassDefinition>> = {}
) => ({
  ...baseLicenseClassDefinition(code, displayOrder),
  ...overrides,
});

describe("NewCandidateModal", () => {
  beforeEach(() => {
    createCandidateMock.mockReset();
    assignCandidateGroupMock.mockReset();
    getCandidateReuseSourcesMock.mockReset();
    getLicenseClassDefinitionsMock.mockReset();
    getGroupsMock.mockReset();
    getTermsMock.mockReset();

    createCandidateMock.mockResolvedValue({
      id: "candidate-1",
      firstName: "Ada",
      lastName: "Yilmaz",
      nationalId: "10000000146",
      phoneNumber: null,
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
    fireEvent.change(screen.getByPlaceholderText("5XX XXX XX XX"), {
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
            // birthDate, gender are no longer collected at quick registration —
            // they are edited from the candidate detail page. email is removed
            // from CandidateUpsertRequest entirely.
            birthDate: null,
            gender: null,
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
    fireEvent.change(screen.getByPlaceholderText("5XX XXX XX XX"), {
      target: { value: "5551234567" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Geçerli bir TC kimlik no girin")).toBeInTheDocument();
    expect(createCandidateMock).not.toHaveBeenCalled();
  });

  it("lists target license classes from global base license classes", async () => {
    getLicenseClassDefinitionsMock.mockImplementation((options) => {
      const items = [
        licenseClassDefinition("A2", 20, { name: "Motosiklet" }),
        licenseClassDefinition("B-OTOMATIK", 40, { name: "Otomatik otomobil" }),
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
    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    await waitFor(() => {
      const select = document.querySelector<HTMLSelectElement>('select[name="className"]');
      expect(select).not.toBeNull();
      expect([...select!.options].map((option) => option.value)).toEqual([
        "A2",
        "B-OTOMATIK",
      ]);
      expect([...select!.options].map((option) => option.textContent)).toEqual([
        "A2",
        "B-OTOMATIK",
      ]);
    });
  });

  it("does not list transition license class rows as target options", async () => {
    getLicenseClassDefinitionsMock.mockImplementation((options) => {
      const activeItems = [
        licenseClassDefinition("B", 10, { name: "Otomobil" }),
        licenseClassDefinition("C", 20, {
          id: "license-c-pre-2016",
          name: "Kamyon",
          existingLicenseType: "B-2016",
        }),
        licenseClassDefinition("C", 21, {
          id: "license-c-after-2016",
          name: "Kamyon",
          existingLicenseType: "B",
        }),
      ];

      return Promise.resolve({
        items: options?.activity === "active" ? activeItems : activeItems,
        page: 1,
        pageSize: options?.pageSize ?? 1000,
        totalCount: activeItems.length,
        totalPages: 1,
        summary: { activeCount: activeItems.length },
      });
    });

    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    await waitFor(() => {
      const select = document.querySelector<HTMLSelectElement>('select[name="className"]');
      expect(select).not.toBeNull();
      expect([...select!.options].map((option) => option.value)).toEqual(["B"]);
    });
  });

  it("lists target license classes from active transitions when an existing license is selected", async () => {
    getLicenseClassDefinitionsMock.mockImplementation((options) => {
      const activeItems = [
        licenseClassDefinition("B", 10, { name: "Otomobil" }),
        licenseClassDefinition("C", 20, { name: "Kamyon" }),
        licenseClassDefinition("D", 30, { name: "Otobüs" }),
        licenseClassDefinition("C", 40, {
          id: "license-b-to-c",
          name: "Kamyon",
          existingLicenseType: "B",
        }),
        licenseClassDefinition("D", 50, {
          id: "license-b-to-d",
          name: "Otobüs",
          existingLicenseType: "B",
        }),
        licenseClassDefinition("D", 60, {
          id: "license-c-to-d",
          name: "Otobüs",
          existingLicenseType: "C",
        }),
      ];

      return Promise.resolve({
        items: options?.activity === "active" ? activeItems : activeItems,
        page: 1,
        pageSize: options?.pageSize ?? 1000,
        totalCount: activeItems.length,
        totalPages: 1,
        summary: { activeCount: activeItems.length },
      });
    });

    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    await waitFor(() => {
      const targetSelect = document.querySelector<HTMLSelectElement>('select[name="className"]');
      expect(targetSelect).not.toBeNull();
      expect([...targetSelect!.options].map((option) => option.value)).toEqual(["B", "C", "D"]);
    });

    const existingLicenseSelect = document.querySelector<HTMLSelectElement>(
      'select[name="existingLicenseType"]'
    );
    expect(existingLicenseSelect).not.toBeNull();
    fireEvent.change(existingLicenseSelect!, { target: { value: "B" } });

    await waitFor(() => {
      const targetSelect = document.querySelector<HTMLSelectElement>('select[name="className"]');
      expect(targetSelect).not.toBeNull();
      expect([...targetSelect!.options].map((option) => option.value)).toEqual(["C", "D"]);
      expect(targetSelect!.value).toBe("C");
    });
  });

  it("lists existing license types from global rules while target classes stay institution scoped", async () => {
    getLicenseClassDefinitionsMock.mockImplementation((options) => {
      const institutionScopedItems = [
        licenseClassDefinition("C", 20, { name: "Kamyon" }),
        licenseClassDefinition("C", 40, {
          id: "license-b-to-c",
          name: "Kamyon",
          existingLicenseType: "B",
        }),
      ];
      const globalItems = [
        licenseClassDefinition("B", 10, { name: "Otomobil" }),
        ...institutionScopedItems,
      ];
      const items = options?.includeInstitutionContext === false ? globalItems : institutionScopedItems;

      return Promise.resolve({
        items: options?.activity === "active" ? items : items,
        page: 1,
        pageSize: options?.pageSize ?? 1000,
        totalCount: items.length,
        totalPages: 1,
        summary: { activeCount: items.length },
      });
    });

    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    const existingLicenseSelect = await waitFor(() => {
      const select = document.querySelector<HTMLSelectElement>('select[name="existingLicenseType"]');
      expect(select).not.toBeNull();
      expect([...select!.options].map((option) => option.value)).toContain("B");
      return select!;
    });

    const targetSelect = document.querySelector<HTMLSelectElement>('select[name="className"]');
    expect(targetSelect).not.toBeNull();
    expect([...targetSelect!.options].map((option) => option.value)).toEqual(["C"]);

    fireEvent.change(existingLicenseSelect, { target: { value: "B" } });

    await waitFor(() => {
      const nextTargetSelect = document.querySelector<HTMLSelectElement>('select[name="className"]');
      expect(nextTargetSelect).not.toBeNull();
      expect([...nextTargetSelect!.options].map((option) => option.value)).toEqual(["C"]);
    });
  });

  it("submits the selected class without resolving a certificate program in the UI", async () => {
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
    fireEvent.change(screen.getByPlaceholderText("5XX XXX XX XX"), {
      target: { value: "5551234567" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createCandidateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          licenseClass: "B",
          existingLicenseType: null,
          existingLicensePre2016: false,
        })
      );
    });
  });

  it("can assign the new candidate to an optional group", async () => {
    getTermsMock.mockResolvedValue({
      items: [
        {
          id: "term-1",
          monthDate: "2026-05-01",
          sequence: 1,
          name: "Mayıs",
          groupCount: 1,
          activeCandidateCount: 0,
          licenseClassCounts: [],
          createdAtUtc: "2026-05-01T00:00:00Z",
          updatedAtUtc: "2026-05-01T00:00:00Z",
          rowVersion: 1,
        },
        {
          id: "term-2",
          monthDate: "2026-06-01",
          sequence: 1,
          name: "Haziran",
          groupCount: 1,
          activeCandidateCount: 0,
          licenseClassCounts: [],
          createdAtUtc: "2026-06-01T00:00:00Z",
          updatedAtUtc: "2026-06-01T00:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 200,
      totalCount: 2,
      totalPages: 1,
    });
    getGroupsMock.mockResolvedValue({
      items: [
        {
          id: "group-1",
          title: "1A",
          term: { id: "term-1", monthDate: "2026-05-01", sequence: 1, name: "Mayıs" },
          capacity: 20,
          assignedCandidateCount: 0,
          activeCandidateCount: 0,
          licenseClassCounts: [],
          startDate: "2026-05-10",
          mebStatus: null,
          createdAtUtc: "2026-05-01T00:00:00Z",
          updatedAtUtc: "2026-05-01T00:00:00Z",
          rowVersion: 1,
        },
        {
          id: "group-2",
          title: "2A",
          term: { id: "term-2", monthDate: "2026-06-01", sequence: 1, name: "Haziran" },
          capacity: 20,
          assignedCandidateCount: 0,
          activeCandidateCount: 0,
          licenseClassCounts: [],
          startDate: "2026-06-10",
          mebStatus: null,
          createdAtUtc: "2026-06-01T00:00:00Z",
          updatedAtUtc: "2026-06-01T00:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 500,
      totalCount: 2,
      totalPages: 1,
    });

    renderWithProviders(<NewCandidateModal onClose={() => {}} onSubmit={() => {}} open />);

    const groupSelect = await waitFor(() => {
      const select = document.querySelector<HTMLSelectElement>('select[name="groupId"]');
      expect(select).not.toBeNull();
      expect([...select!.options].map((option) => option.value)).toEqual(["", "group-2", "group-1"]);
      expect(select!.options[1].textContent).toContain("HAZİRAN 2026");
      return select!;
    });
    fireEvent.change(groupSelect!, { target: { value: "group-1" } });

    fireEvent.change(screen.getByPlaceholderText("11 haneli TC"), {
      target: { value: "10000000146" },
    });
    fireEvent.change(screen.getByPlaceholderText("Adı"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByPlaceholderText("Soyadı"), {
      target: { value: "Yilmaz" },
    });
    fireEvent.change(screen.getByPlaceholderText("5XX XXX XX XX"), {
      target: { value: "5551234567" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createCandidateMock).toHaveBeenCalled();
      expect(assignCandidateGroupMock).toHaveBeenCalledWith("candidate-1", "group-1");
    });
  });

  it("does not list inactive global license classes as targets", async () => {
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
          // Birth date, gender, and existing license info are no longer
          // copied from a reuse source — they are edited from the candidate
          // detail page.
          birthDate: null,
          gender: null,
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
