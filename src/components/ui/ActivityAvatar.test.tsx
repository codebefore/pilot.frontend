import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthorizedObjectUrl } from "../../lib/authorized-files";
import { applyRuntimeConfig } from "../../lib/api";
import { ActivityAvatar } from "./ActivityAvatar";

vi.mock("../../lib/authorized-files", () => ({
  createAuthorizedObjectUrl: vi.fn(() => Promise.resolve("blob:activity-avatar")),
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
