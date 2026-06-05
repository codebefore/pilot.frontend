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

  it("hides channel buttons until the phone is valid", () => {
    render();

    expect(screen.queryByRole("button", { name: /WhatsApp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /SMS/i })).not.toBeInTheDocument();
  });

  it("shows WhatsApp disabled and SMS enabled when the phone is valid", () => {
    render();

    fireEvent.change(screen.getByLabelText("Telefon"), {
      target: { value: "5551112233" },
    });

    expect(screen.getByRole("button", { name: /WhatsApp/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /SMS/i })).toBeEnabled();
  });

  it("calls requestLoginCode with channel=sms when the SMS button is clicked", async () => {
    const requestLoginCode = vi.fn().mockResolvedValue({
      phone: "5551112233",
      expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
    });

    render(requestLoginCode);

    fireEvent.change(screen.getByLabelText("Telefon"), {
      target: { value: "5551112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: /SMS/i }));

    await waitFor(() => {
      expect(requestLoginCode).toHaveBeenCalledWith("5551112233", "sms");
    });
  });

  it("shows the SMS-flavoured code label and hint after an SMS request", async () => {
    const requestLoginCode = vi.fn().mockResolvedValue({
      phone: "5551112233",
      expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
    });

    render(requestLoginCode);

    fireEvent.change(screen.getByLabelText("Telefon"), {
      target: { value: "5551112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: /SMS/i }));

    await waitFor(() => {
      expect(screen.getByText("SMS Kodu")).toBeInTheDocument();
    });
    expect(screen.getByText(/SMS olarak gönderildi/i)).toBeInTheDocument();
    expect(screen.getByText(/0:59|1:00/i)).toBeInTheDocument();
  });

  it("resend uses the channel originally selected", async () => {
    const requestLoginCode = vi.fn().mockResolvedValue({
      phone: "5551112233",
      expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
    });

    render(requestLoginCode);

    fireEvent.change(screen.getByLabelText("Telefon"), {
      target: { value: "5551112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: /SMS/i }));

    await waitFor(() => {
      expect(screen.getByText("SMS Kodu")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Tekrar Gönder/i }));

    await waitFor(() => {
      expect(requestLoginCode).toHaveBeenCalledTimes(2);
    });
    expect(requestLoginCode).toHaveBeenLastCalledWith("5551112233", "sms");
  });

  it("disables verification when the SMS code is expired", async () => {
    const requestLoginCode = vi.fn().mockResolvedValue({
      phone: "5551112233",
      expiresAtUtc: new Date(Date.now() - 1000).toISOString(),
    });
    const login = vi.fn();

    render(requestLoginCode, login);

    fireEvent.change(screen.getByLabelText("Telefon"), {
      target: { value: "5551112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: /SMS/i }));

    await waitFor(() => {
      expect(screen.getByText(/Kodun süresi doldu/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("SMS Kodu"), {
      target: { value: "123456" },
    });

    const submit = screen.getByRole("button", { name: /Giriş Yap/i });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(login).not.toHaveBeenCalled();
  });

  it("shows validation and no channel buttons when the phone is invalid", async () => {
    const requestLoginCode = vi.fn();
    render(requestLoginCode);

    fireEvent.change(screen.getByLabelText("Telefon"), {
      target: { value: "123" },
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /SMS/i })).not.toBeInTheDocument();
    });
    expect(requestLoginCode).not.toHaveBeenCalled();
  });
});
