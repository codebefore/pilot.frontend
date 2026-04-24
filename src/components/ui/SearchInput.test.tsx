import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchInput } from "./SearchInput";

describe("SearchInput", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("discards pending debounced text when resetSignal changes", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();

    const { rerender } = render(
      <SearchInput
        debounceMs={300}
        onChange={onChange}
        placeholder="Ara"
        resetSignal={0}
        value=""
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Ara"), {
      target: { value: "EGT" },
    });

    rerender(
      <SearchInput
        debounceMs={300}
        onChange={onChange}
        placeholder="Ara"
        resetSignal={1}
        value=""
      />
    );

    expect(screen.getByPlaceholderText("Ara")).toHaveValue("");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
