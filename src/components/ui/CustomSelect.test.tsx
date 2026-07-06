import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
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

  it("does not commit arrow-key navigation until the user confirms", async () => {
    const onChange = vi.fn();
    render(
      <CustomSelect aria-label="Sınav durumu" onChange={onChange} value="attended">
        <option value="">—</option>
        <option value="attended">Girdi</option>
        <option value="absent">Girmedi</option>
      </CustomSelect>
    );

    const trigger = screen.getByRole("button", { name: "Girdi" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("button", { name: "Girdi" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(trigger, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Girdi" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves focus to the first option matching a typed letter", async () => {
    render(
      <CustomSelect aria-label="İl" defaultValue="">
        <option value="">İl</option>
        <option value="Ankara">Ankara</option>
        <option value="Ordu">Ordu</option>
        <option value="Osmaniye">Osmaniye</option>
      </CustomSelect>
    );

    const trigger = screen.getByRole("button", { name: "İl" });
    fireEvent.keyDown(trigger, { key: "O" });

    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    const option = screen.getByRole("option", { name: "Ordu" });
    expect(option).toHaveClass("active");
    expect(option).toHaveFocus();

    fireEvent.keyDown(option, { key: "Enter" });

    expect(screen.getByRole("button", { name: "Ordu" })).toBeInTheDocument();
  });

  it("commits the typeahead option when Enter is pressed", () => {
    const changedValues: string[] = [];
    render(
      <CustomSelect
        aria-label="İl"
        onChange={(event) => changedValues.push(event.currentTarget.value)}
        value=""
      >
        <option value="">İl</option>
        <option value="Ankara">Ankara</option>
        <option value="Ordu">Ordu</option>
        <option value="Osmaniye">Osmaniye</option>
      </CustomSelect>
    );

    const trigger = screen.getByRole("button", { name: "İl" });
    fireEvent.keyDown(trigger, { key: "O" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(changedValues).toEqual(["Ordu"]);
  });

  it("commits the typeahead option on Enter even before the open state is observed", () => {
    const changedValues: string[] = [];
    render(
      <CustomSelect
        aria-label="İl"
        onChange={(event) => changedValues.push(event.currentTarget.value)}
        value=""
      >
        <option value="">İl</option>
        <option value="Ankara">Ankara</option>
        <option value="Ordu">Ordu</option>
      </CustomSelect>
    );

    const trigger = screen.getByRole("button", { name: "İl" });
    fireEvent.keyDown(trigger, { key: "O" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(changedValues).toEqual(["Ordu"]);
  });

  it("handles typeahead and Enter when focus is outside the trigger while the menu is open", async () => {
    const changedValues: string[] = [];
    render(
      <CustomSelect
        aria-label="İl"
        onChange={(event) => changedValues.push(event.currentTarget.value)}
        value=""
      >
        <option value="">İl</option>
        <option value="Ankara">Ankara</option>
        <option value="Ordu">Ordu</option>
        <option value="Osmaniye">Osmaniye</option>
      </CustomSelect>
    );

    fireEvent.click(screen.getByRole("button", { name: "İl" }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "O" });
    expect(screen.getByRole("option", { name: "Ordu" })).toHaveClass("active");

    fireEvent.keyDown(document, { key: "Enter" });
    expect(changedValues).toEqual(["Ordu"]);
  });

  it("closes after province typeahead commit before dependent district options rerender", async () => {
    function AddressSelects() {
      const [address, setAddress] = useState({ district: "", province: "" });
      const districtOptions =
        address.province === "Ordu" ? ["Altınordu", "Fatsa"] : ["Çankaya"];

      return (
        <>
          <CustomSelect
            aria-label="İl"
            onChange={(event) =>
              setAddress({
                province: event.currentTarget.value,
                district: "",
              })
            }
            value={address.province}
          >
            <option value="">İl</option>
            <option value="Ankara">Ankara</option>
            <option value="Ordu">Ordu</option>
            <option value="Osmaniye">Osmaniye</option>
          </CustomSelect>
          <CustomSelect
            aria-label="İlçe"
            disabled={!address.province}
            onChange={(event) =>
              setAddress((current) => ({
                ...current,
                district: event.currentTarget.value,
              }))
            }
            value={address.district}
          >
            <option value="">İlçe</option>
            {districtOptions.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </CustomSelect>
        </>
      );
    }

    render(<AddressSelects />);

    const provinceTrigger = screen.getByRole("button", { name: "İl" });
    fireEvent.click(provinceTrigger);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(provinceTrigger, { key: "O" });
    const provinceOption = screen.getByRole("option", { name: "Ordu" });
    expect(provinceOption).toHaveFocus();

    fireEvent.keyDown(provinceOption, { key: "Enter" });

    expect(screen.getByRole("button", { name: "Ordu" })).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "İlçe" })).toBeEnabled();
  });

  it("can commit and close immediately on typeahead", async () => {
    const changedValues: string[] = [];
    render(
      <CustomSelect
        aria-label="İl"
        commitOnTypeahead
        onChange={(event) => changedValues.push(event.currentTarget.value)}
        value=""
      >
        <option value="">İl</option>
        <option value="Ankara">Ankara</option>
        <option value="Ordu">Ordu</option>
        <option value="Osmaniye">Osmaniye</option>
      </CustomSelect>
    );

    fireEvent.click(screen.getByRole("button", { name: "İl" }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("button", { name: "İl" }), { key: "O" });

    expect(changedValues).toEqual(["Ordu"]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not reopen on Enter immediately after typeahead commit", async () => {
    const changedValues: string[] = [];
    render(
      <CustomSelect
        aria-label="İl"
        commitOnTypeahead
        onChange={(event) => changedValues.push(event.currentTarget.value)}
        value=""
      >
        <option value="">İl</option>
        <option value="Ankara">Ankara</option>
        <option value="Ordu">Ordu</option>
      </CustomSelect>
    );

    const trigger = screen.getByRole("button", { name: "İl" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "O" });
    expect(changedValues).toEqual(["Ordu"]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
