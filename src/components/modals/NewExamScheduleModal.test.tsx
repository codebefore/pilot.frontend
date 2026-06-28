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

vi.mock("../ui/LocalizedTimeInput", () => ({
  LocalizedTimeInput: ({
    ariaLabel,
    value,
    onChange,
  }: {
    ariaLabel?: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.currentTarget.value)}
      type="time"
      value={value}
    />
  ),
}));

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
        examCodes={[{
          id: "code-1",
          examType: "uygulama",
          code: "100000001",
          createdAtUtc: "2026-05-23T00:00:00Z",
          scheduleCount: 0,
          candidateCount: 0,
        }]}
        examType="uygulama"
        onClose={() => {}}
        onSaved={onSaved}
        open
      />
    );

    expect(screen.queryByLabelText(/^Saat/)).not.toBeInTheDocument();

    const capacityInput = screen.getByLabelText(/^Kontenjan/) as HTMLInputElement;
    expect(capacityInput.value).toBe("10");
    fireEvent.change(capacityInput, { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createExamScheduleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          examType: "uygulama",
          date: expect.any(String),
          examCodeId: "code-1",
          capacity: 24,
        })
      );
    });
    const payload = createExamScheduleMock.mock.calls[0]?.[0];
    expect(payload).not.toHaveProperty("time");
    expect(onSaved).toHaveBeenCalled();
  });

  it("keeps the time field and hides capacity for e-sinav", async () => {
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

    expect(screen.getByLabelText(/^Saat/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Kontenjan/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(createExamScheduleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          examType: "e_sinav",
          time: "09:00",
          capacity: 20,
        })
      );
    });
    expect(onSaved).toHaveBeenCalled();
  });
});
