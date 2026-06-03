import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "./LoginPage";
import { renderWithProviders } from "../test/render-with-providers";

function render(requestLoginCodeMock = vi.fn(), loginMock = vi.fn()) {
  return renderWithProviders(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
    {
      auth: {
        user: null,
        accessToken: null,
        institutions: [],
        activeInstitution: null,
        permissions: {},
        hasInstitution: false,
        institutionRequired: false,
        requestLoginCode: requestLoginCodeMock as unknown as never,
        login: loginMock as unknown as never,
        selectInstitution: vi.fn() as unknown as never,
        logout: vi.fn(),
      },
    }
  );
}

describe("LoginPage channel selection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders two channel buttons before any code is requested", () => {
    render();

    expect(screen.getByRole("button", { name: /WhatsApp ile Gönder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /SMS ile Gönder/i })).toBeInTheDocument();
  });

  it("calls requestLoginCode with channel=whatsapp when the WhatsApp button is clicked", async () => {
    const requestLoginCode = vi.fn().mockResolvedValue({
      phone: "5551112233",
      expiresAtUtc: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    render(requestLoginCode);

    fireEvent.change(screen.getByLabelText("Telefon"), {
      target: { value: "5551112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: /WhatsApp ile Gönder/i }));

    await waitFor(() => {
      expect(requestLoginCode).toHaveBeenCalledWith("5551112233", "whatsapp");
    });
  });

  it("calls requestLoginCode with channel=sms when the SMS button is clicked", async () => {
    const requestLoginCode = vi.fn().mockResolvedValue({
      phone: "5551112233",
      expiresAtUtc: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    render(requestLoginCode);

    fireEvent.change(screen.getByLabelText("Telefon"), {
      target: { value: "5551112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: /SMS ile Gönder/i }));

    await waitFor(() => {
      expect(requestLoginCode).toHaveBeenCalledWith("5551112233", "sms");
    });
  });

  it("shows the WhatsApp-flavoured code label and hint after a WhatsApp request", async () => {
    const requestLoginCode = vi.fn().mockResolvedValue({
      phone: "5551112233",
      expiresAtUtc: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    render(requestLoginCode);

    fireEvent.change(screen.getByLabelText("Telefon"), {
      target: { value: "5551112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: /WhatsApp ile Gönder/i }));

    await waitFor(() => {
      expect(screen.getByText("WhatsApp Kodu")).toBeInTheDocument();
    });
    expect(screen.getByText(/WhatsApp üzerinden gönderildi/i)).toBeInTheDocument();
  });

  it("shows the SMS-flavoured code label and hint after an SMS request", async () => {
    const requestLoginCode = vi.fn().mockResolvedValue({
      phone: "5551112233",
      expiresAtUtc: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    render(requestLoginCode);

    fireEvent.change(screen.getByLabelText("Telefon"), {
      target: { value: "5551112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: /SMS ile Gönder/i }));

    await waitFor(() => {
      expect(screen.getByText("SMS Kodu")).toBeInTheDocument();
    });
    expect(screen.getByText(/SMS olarak gönderildi/i)).toBeInTheDocument();
  });

  it("resend uses the channel originally selected", async () => {
    const requestLoginCode = vi.fn().mockResolvedValue({
      phone: "5551112233",
      expiresAtUtc: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    render(requestLoginCode);

    fireEvent.change(screen.getByLabelText("Telefon"), {
      target: { value: "5551112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: /SMS ile Gönder/i }));

    await waitFor(() => {
      expect(screen.getByText("SMS Kodu")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Tekrar Gönder/i }));

    await waitFor(() => {
      expect(requestLoginCode).toHaveBeenCalledTimes(2);
    });
    expect(requestLoginCode).toHaveBeenLastCalledWith("5551112233", "sms");
  });

  it("does not call requestLoginCode when the phone field is empty", async () => {
    const requestLoginCode = vi.fn();
    render(requestLoginCode);

    fireEvent.click(screen.getByRole("button", { name: /WhatsApp ile Gönder/i }));

    // Schema rejects the empty phone before the mock is called.
    await waitFor(() => {
      expect(screen.getByText("Telefon gerekli")).toBeInTheDocument();
    });
    expect(requestLoginCode).not.toHaveBeenCalled();
  });
});
