import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomSelect } from "./CustomSelect";

describe("CustomSelect", () => {
  const originalInnerHeight = window.innerHeight;
  const originalInnerWidth = window.innerWidth;
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight"
  );

  afterEach(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalInnerWidth,
    });
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    }
  });

  it("renders the menu in a body portal with small select styling", async () => {
    render(
      <CustomSelect aria-label="Sınav durumu" size="sm" value="attended">
        <option value="">—</option>
        <option value="attended">Girdi</option>
        <option value="absent">Girmedi</option>
      </CustomSelect>
    );

    fireEvent.click(screen.getByRole("button", { name: "Girdi" }));

    const menu = await screen.findByRole("listbox");
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveClass("custom-select-menu--small");
    expect(screen.getByRole("option", { name: "Girmedi" })).toHaveClass(
      "custom-select-option--small"
    );
  });

  it("opens upward and stays inside the viewport when there is not enough space below", async () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 180,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return this.getAttribute("role") === "listbox" ? 120 : 0;
      },
    });

    render(
      <CustomSelect aria-label="Sınav sonucu" size="sm" value="passed">
        <option value="">—</option>
        <option value="passed">Başarılı</option>
        <option value="failed">Başarısız</option>
      </CustomSelect>
    );

    const trigger = screen.getByRole("button", { name: "Başarılı" });
    const root = trigger.closest(".custom-select");
    if (!root) {
      throw new Error("custom select root not found");
    }
    root.getBoundingClientRect = () =>
      ({
        bottom: 172,
        height: 28,
        left: 290,
        right: 350,
        top: 144,
        width: 60,
        x: 290,
        y: 144,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(trigger);

    const menu = await screen.findByRole("listbox");
    await waitFor(() => {
      expect(menu).toHaveStyle({ left: "252px", top: "16px" });
    });
    expect(menu).toHaveStyle({ maxHeight: "128px", position: "fixed", width: "60px" });
  });

  it("notifies callers when the portal menu scrolls", async () => {
    const onMenuScroll = vi.fn();
    render(
      <CustomSelect aria-label="Dönem" onMenuScroll={onMenuScroll} value="">
        <option value="">—</option>
        <option value="term-1">2026 Nisan</option>
      </CustomSelect>
    );

    fireEvent.click(screen.getByRole("button", { name: "—" }));
    fireEvent.scroll(await screen.findByRole("listbox"));

    expect(onMenuScroll).toHaveBeenCalledTimes(1);
  });
});
