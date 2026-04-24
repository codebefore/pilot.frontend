import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/render-with-providers";
import { NewExamScheduleModal } from "./NewExamScheduleModal";

const createExamScheduleMock = vi.fn();

vi.mock("../../lib/exam-schedules-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/exam-schedules-api")>(
    "../../lib/exam-schedules-api"
  );
  return {
    ...actual,
    createExamSchedule: (...args: Parameters<typeof actual.createExamSchedule>) =>
      createExamScheduleMock(...args),
  };
});

describe("NewExamScheduleModal", () => {
  beforeEach(() => {
    createExamScheduleMock.mockReset();
    createExamScheduleMock.mockResolvedValue({
      id: "schedule-1",
      examType: "uygulama",
      date: "2026-06-03",
      time: "09:00",
      capacity: 20,
      candidateCount: 0,
      licenseClassCounts: [],
    });
  });

  it("hides the time field for uygulama and submits without time", async () => {
    const onSaved = vi.fn();

    renderWithProviders(
      <NewExamScheduleModal
        examType="uygulama"
        onClose={() => {}}
        onSaved={onSaved}
        open
      />
    );

    expect(screen.queryByLabelText("Saat")).not.toBeInTheDocument();

    const capacityInput = screen.getByLabelText("Kontenjan");
    fireEvent.change(capacityInput, { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createExamScheduleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          examType: "uygulama",
          date: expect.any(String),
          capacity: 24,
        })
      );
    });
    const payload = createExamScheduleMock.mock.calls[0]?.[0];
    expect(payload).not.toHaveProperty("time");
    expect(onSaved).toHaveBeenCalled();
  });

  it("keeps the time field for e-sinav and submits the chosen time", async () => {
    const onSaved = vi.fn();

    createExamScheduleMock.mockResolvedValue({
      id: "schedule-2",
      examType: "e_sinav",
      date: "2026-05-12",
      time: "10:30",
      capacity: 30,
      candidateCount: 0,
      licenseClassCounts: [],
    });

    renderWithProviders(
      <NewExamScheduleModal
        examType="e_sinav"
        onClose={() => {}}
        onSaved={onSaved}
        open
      />
    );

    fireEvent.focus(screen.getByLabelText("Saat"));
    fireEvent.click(screen.getByRole("option", { name: "10:30" }));
    fireEvent.change(screen.getByLabelText("Kontenjan"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createExamScheduleMock).toHaveBeenCalledWith({
        examType: "e_sinav",
        date: expect.any(String),
        capacity: 30,
        time: "10:30",
      });
    });
    expect(onSaved).toHaveBeenCalled();
  });
});
