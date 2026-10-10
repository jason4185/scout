import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { approveFlow, fakeQuote } = vi.hoisted(() => ({
  approveFlow: vi.fn().mockResolvedValue(undefined),
  fakeQuote: {
    distribution: {
      leaderTimeunitsAllocation: 120n,
      validatorTimeunitsAllocation: 240n,
      appealRounds: 1n,
      executionBudgetPerRound: 10_000_000_000_000_000n,
      executionConsumed: 0n,
      totalMessageFees: 5_000_000_000_000_000n,
      rotations: [0n, 1n],
      maxPriceGenPerTimeUnit: 2_000_000_000_000n,
      storageFeeMaxGasPrice: 12_345n,
      receiptFeeMaxGasPrice: 67_890n,
    },
    feeValue: 25_000_000_000_000_000n,
    userValue: 0n,
    total: 25_000_000_000_000_000n,
    source: "network-default" as const,
    verification: { status: "verified" as const, expectedHash: "0xpolicy" as `0x${string}` },
    breakdown: {
      timeUnitFees: 10_000_000_000_000_000n,
      executionBudget: 10_000_000_000_000_000n,
      messageFees: 5_000_000_000_000_000n,
    },
    caps: {
      genPerTimeUnit: 2_000_000_000_000n,
      storagePrice: 12_345n,
      receiptPrice: 67_890n,
    },
    refundable: true as const,
  },
}));

vi.mock("@genlayer/transaction-kit-react", () => ({
  CapsShield: () => <div>Fee caps</div>,
  FeeReceipt: () => <div>Fee receipt</div>,
  HoldToSign: ({
    disabled,
    label,
    onConfirm,
  }: {
    disabled?: boolean;
    label?: string;
    onConfirm: () => void;
  }) => (
    <button className="gltk-hold" type="button" disabled={disabled} onClick={onConfirm}>
      {label}
    </button>
  ),
  PresetSelector: () => <div>Fee preset</div>,
  Timeline: () => <div>Transaction timeline</div>,
  VerifyBadge: () => <div>Fee policy verified</div>,
  useTransactionFlow: () => ({
    state: { step: "review" as const, preset: "standard" as const, quote: fakeQuote },
    preset: "standard" as const,
    setPreset: vi.fn(),
    overrides: {},
    setOverrides: vi.fn(),
    quote: fakeQuote,
    verification: { feeConfigHash: "0xpolicy", summary: {} },
    canCancel: false,
    canTopUp: false,
    approve: approveFlow,
    cancel: vi.fn().mockResolvedValue(undefined),
    topUp: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
  }),
}));

import { TransactionRunner } from "./transaction";

describe("SCOUT Transaction Kit presentation", () => {
  it("renders a readable review portal with long values contained", async () => {
    const onDismiss = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(
      <TransactionRunner
        kit={{} as never}
        client={{} as never}
        account="0x1234567890abcdef1234567890abcdef12345678"
        write={{
          kind: "write",
          address: "0x0000000000000000000000000000000000000001",
          method: "register_agent",
          args: ["Provider", "Security intelligence", "", ""],
        }}
        onSuccess={vi.fn()}
        onError={vi.fn()}
        onDismiss={onDismiss}
        intro={<strong>Register a provider agent</strong>}
      />,
    );

    expect(await screen.findByRole("dialog", { name: "SCOUT transaction" })).toBeInTheDocument();
    expect(screen.getByText("Review transaction")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Register Agent" })).toBeInTheDocument();
    expect(screen.getByText("GenLayer Studio Next · Chain 61997")).toBeInTheDocument();
    expect(screen.getByText("0x1234…5678")).toBeInTheDocument();
    expect(screen.getByText("Fee receipt")).toBeInTheDocument();
    expect(screen.getByText("Advanced fee details")).toBeInTheDocument();
    const footer = screen.getByRole("region", { name: "Transaction actions" });
    const approveButton = within(footer).getByRole("button", { name: "Hold to confirm" });
    const cancel = within(footer).getByRole("button", { name: "Cancel" });
    expect(approveButton).toBeInTheDocument();
    expect(
      screen.getByText(
        "Click once on desktop. On touch devices, press and hold until the progress completes.",
      ),
    ).toBeInTheDocument();
    expect(footer.querySelector(".gltk-hold")).toBe(approveButton);
    approveButton.focus();
    expect(document.activeElement).toBe(approveButton);
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(approveButton);
    expect(approveFlow).toHaveBeenCalledTimes(1);
    fireEvent.click(cancel);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument());

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("keeps a payable subscription protocol value at exactly 2 GEN", async () => {
    render(
      <TransactionRunner
        kit={{} as never}
        client={{} as never}
        account="0x1234567890abcdef1234567890abcdef12345678"
        write={{
          kind: "write",
          address: "0x0000000000000000000000000000000000000001",
          method: "subscribe",
          args: [1n, 2n, "Security alerts", "Linux", 86400n, 3n, 6n, 5n],
          value: 2_000_000_000_000_000_000n,
        }}
        onSuccess={vi.fn()}
        onError={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const protocolValue = await screen.findByLabelText("Protocol value");
    expect(protocolValue).toHaveTextContent("2 GEN");
    expect(
      within(screen.getByRole("region", { name: "Transaction actions" })).getByRole("button", {
        name: "Hold to confirm",
      }),
    ).toBeInTheDocument();
  });
});
