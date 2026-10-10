import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HoldToSign } from "@genlayer/transaction-kit-react";

describe("installed Transaction Kit HoldToSign", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("confirms once after the supported touch hold completes", () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    render(<HoldToSign onConfirm={onConfirm} holdMs={900} label="Hold to confirm" />);
    const button = screen.getByRole("button", { name: "Hold to confirm hold to confirm" });

    fireEvent.pointerDown(button, { pointerType: "touch" });
    expect(button).toHaveAttribute("data-holding", "true");
    vi.advanceTimersByTime(899);
    expect(onConfirm).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(button, { pointerType: "touch" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not confirm an incomplete touch hold", () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    render(<HoldToSign onConfirm={onConfirm} holdMs={900} label="Hold to confirm" />);
    const button = screen.getByRole("button", { name: "Hold to confirm hold to confirm" });

    fireEvent.pointerDown(button, { pointerType: "touch" });
    vi.advanceTimersByTime(400);
    fireEvent.pointerUp(button, { pointerType: "touch" });
    vi.advanceTimersByTime(1000);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(button).not.toHaveAttribute("data-holding");
  });

  it("uses a normal click for mouse and does not submit when disabled", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<HoldToSign onConfirm={onConfirm} label="Hold to confirm" />);
    const button = screen.getByRole("button", { name: "Hold to confirm hold to confirm" });
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(<HoldToSign onConfirm={onConfirm} disabled label="Hold to confirm" />);
    const disabledButton = screen.getByRole("button", { name: "Hold to confirm hold to confirm" });
    fireEvent.click(disabledButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
