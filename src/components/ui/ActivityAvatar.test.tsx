import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthorizedObjectUrl } from "../../lib/authorized-files";
import { applyRuntimeConfig } from "../../lib/api";
import { getInstructors } from "../../lib/instructors-api";
import { ActivityAvatar } from "./ActivityAvatar";

vi.mock("../../lib/authorized-files", () => ({
  createAuthorizedObjectUrl: vi.fn(() => Promise.resolve("blob:activity-avatar")),
}));

vi.mock("../../lib/instructors-api", () => ({
  getInstructors: vi.fn(() =>
    Promise.resolve({
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 0,
      summary: {
        activeCount: 0,
        masterInstructorCount: 0,
        specialistInstructorCount: 0,
        practiceBranchCount: 0,
      },
    })
  ),
}));

describe("ActivityAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyRuntimeConfig({});
  });

  it("loads actor photos through the authorized file helper", async () => {
    render(
      <ActivityAvatar
        activity={{
          id: "activity-1",
          avatar: "F",
          avatarTone: "brand",
          actor: "Finans",
          description: "tahsilat alındı",
          time: "Güncel",
          createdAtUtc: "2026-06-27T10:00:00Z",
          linkPath: null,
          actorDisplayName: "Ayşe Yılmaz",
          actorPhotoUrl: "/api/users/user-1/photo",
        }}
      />
    );

    expect(createAuthorizedObjectUrl).toHaveBeenCalledWith(
      "/api/users/user-1/photo",
      expect.any(AbortSignal)
    );
    expect(await screen.findByRole("img", { name: "Ayşe Yılmaz" })).toHaveAttribute(
      "src",
      "blob:activity-avatar"
    );
  });

  it("falls back to actor initials when no photo is available", () => {
    render(
      <ActivityAvatar
        activity={{
          id: "activity-1",
          avatar: "F",
          avatarTone: "brand",
          actor: "Finans",
          description: "tahsilat alındı",
          time: "Güncel",
          createdAtUtc: "2026-06-27T10:00:00Z",
          linkPath: null,
          actorDisplayName: "Ayşe Yılmaz",
          actorPhotoUrl: null,
        }}
      />
    );

    expect(screen.getByText("AY")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("falls back to matching personnel photos when actor photo url is missing", async () => {
    vi.mocked(getInstructors).mockResolvedValue({
      items: [
        {
          id: "instructor-1",
          firstName: "Ayşe",
          lastName: "Yılmaz",
          nationalId: null,
          phoneNumber: null,
          email: null,
          isActive: true,
          role: "specialist_instructor",
          employmentType: "salaried",
          branches: [],
          licenseClassCodes: [],
          weeklyLessonHours: null,
          mebbisPermitNo: null,
          contractStartDate: null,
          contractEndDate: null,
          assignedVehicleId: null,
          notes: null,
          hasPhoto: true,
          leftAtDate: null,
          leaveReason: null,
          createdAtUtc: "2026-06-27T10:00:00Z",
          updatedAtUtc: "2026-06-27T10:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
        masterInstructorCount: 0,
        specialistInstructorCount: 0,
        practiceBranchCount: 0,
      },
    });

    render(
      <ActivityAvatar
        activity={{
          id: "activity-1",
          avatar: "F",
          avatarTone: "brand",
          actor: "Finans",
          description: "tahsilat alındı",
          time: "Güncel",
          createdAtUtc: "2026-06-27T10:00:00Z",
          linkPath: null,
          actorDisplayName: "Ayşe Yılmaz",
          actorPhotoUrl: null,
        }}
      />
    );

    expect(await screen.findByRole("img", { name: "Ayşe Yılmaz" })).toHaveAttribute(
      "src",
      "blob:activity-avatar"
    );
    expect(createAuthorizedObjectUrl).toHaveBeenCalledWith(
      expect.stringContaining("/api/training/instructors/instructor-1/photo"),
      expect.any(AbortSignal)
    );
  });

  it("matches personnel photos by phone before falling back to the display name", async () => {
    vi.mocked(getInstructors).mockResolvedValue({
      items: [
        {
          id: "instructor-1",
          firstName: "Başka",
          lastName: "Personel",
          nationalId: null,
          phoneNumber: "5551112233",
          email: null,
          isActive: true,
          role: "specialist_instructor",
          employmentType: "salaried",
          branches: [],
          licenseClassCodes: [],
          weeklyLessonHours: null,
          mebbisPermitNo: null,
          contractStartDate: null,
          contractEndDate: null,
          assignedVehicleId: null,
          notes: null,
          hasPhoto: true,
          leftAtDate: null,
          leaveReason: null,
          createdAtUtc: "2026-06-27T10:00:00Z",
          updatedAtUtc: "2026-06-27T10:00:00Z",
          rowVersion: 1,
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      summary: {
        activeCount: 1,
        masterInstructorCount: 0,
        specialistInstructorCount: 0,
        practiceBranchCount: 0,
      },
    });

    render(
      <ActivityAvatar
        activity={{
          id: "activity-1",
          avatar: "K",
          avatarTone: "purple",
          actor: "Kullanıcı",
          description: "kullanıcı notu eklendi",
          time: "Güncel",
          createdAtUtc: "2026-06-27T10:00:00Z",
          linkPath: null,
          actorDisplayName: "Ayşe Yılmaz",
          actorPhoneNumber: "05551112233",
          actorPhotoUrl: null,
        }}
      />
    );

    expect(getInstructors).toHaveBeenCalledWith(
      expect.objectContaining({ search: "5551112233" }),
      expect.any(AbortSignal)
    );
    expect(await screen.findByRole("img", { name: "Ayşe Yılmaz" })).toHaveAttribute(
      "src",
      "blob:activity-avatar"
    );
  });

  it("does not send authorization through the helper for external photo URLs", async () => {
    render(
      <ActivityAvatar
        activity={{
          id: "activity-1",
          avatar: "F",
          avatarTone: "brand",
          actor: "Finans",
          description: "tahsilat alındı",
          time: "Güncel",
          createdAtUtc: "2026-06-27T10:00:00Z",
          linkPath: null,
          actorDisplayName: "Ayşe Yılmaz",
          actorPhotoUrl: "https://cdn.example.com/user-1.jpg",
        }}
      />
    );

    expect(createAuthorizedObjectUrl).not.toHaveBeenCalled();
    expect(await screen.findByRole("img", { name: "Ayşe Yılmaz" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/user-1.jpg"
    );
  });

  it("uses the authorized helper for configured API origins", async () => {
    applyRuntimeConfig({
      authApiBaseUrl: "https://identity.pilot.test",
    });

    render(
      <ActivityAvatar
        activity={{
          id: "activity-1",
          avatar: "F",
          avatarTone: "brand",
          actor: "Finans",
          description: "tahsilat alındı",
          time: "Güncel",
          createdAtUtc: "2026-06-27T10:00:00Z",
          linkPath: null,
          actorDisplayName: "Ayşe Yılmaz",
          actorPhotoUrl: "https://identity.pilot.test/api/users/user-1/photo",
        }}
      />
    );

    expect(createAuthorizedObjectUrl).toHaveBeenCalledWith(
      "https://identity.pilot.test/api/users/user-1/photo",
      expect.any(AbortSignal)
    );
    expect(await screen.findByRole("img", { name: "Ayşe Yılmaz" })).toHaveAttribute(
      "src",
      "blob:activity-avatar"
    );
  });

  it("ignores unsafe photo URL schemes", () => {
    render(
      <ActivityAvatar
        activity={{
          id: "activity-1",
          avatar: "F",
          avatarTone: "brand",
          actor: "Finans",
          description: "tahsilat alındı",
          time: "Güncel",
          createdAtUtc: "2026-06-27T10:00:00Z",
          linkPath: null,
          actorDisplayName: "Ayşe Yılmaz",
          actorPhotoUrl: "javascript:alert(1)",
        }}
      />
    );

    expect(createAuthorizedObjectUrl).not.toHaveBeenCalled();
    expect(screen.getByText("AY")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
