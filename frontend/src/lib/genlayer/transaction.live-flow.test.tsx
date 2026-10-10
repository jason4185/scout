import {
  createTransactionKit,
  type PolicyQuote,
  type TransactionKit,
  type TrackedStatus,
} from "@genlayer/transaction-kit";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { instrumentWalletProvider } from "./diagnostics";
import { studioNext } from "./network";
import { TransactionRunner } from "./transaction";

const payableValue = 2_000_000_000_000_000_000n;
const quote: PolicyQuote = {
  distribution: {
    leaderTimeunitsAllocation: 1n,
    validatorTimeunitsAllocation: 1n,
    appealRounds: 1n,
    executionBudgetPerRound: 1n,
    executionConsumed: 0n,
    totalMessageFees: 0n,
    rotations: [0n, 0n],
    maxPriceGenPerTimeUnit: 1n,
    storageFeeMaxGasPrice: 1n,
    receiptFeeMaxGasPrice: 1n,
  },
  feeValue: 1n,
  userValue: payableValue,
  total: payableValue + 1n,
  source: "network-default",
  verification: { status: "verified" },
  breakdown: { timeUnitFees: 1n, executionBudget: 0n, messageFees: 0n },
  caps: { genPerTimeUnit: 1n, storagePrice: 1n, receiptPrice: 1n },
  refundable: true,
};

function makeKit() {
  const status: TrackedStatus = {
    phase: "decided",
    genlayerTxId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    statusName: "ACCEPTED",
    executionResultName: "FINISHED_WITH_RETURN",
    successful: true,
  };
  return {
    estimate: vi.fn().mockResolvedValue(quote),
    submit: vi.fn().mockResolvedValue({ genlayerTxId: status.genlayerTxId }),
    track: vi.fn().mockResolvedValue(status),
    verification: vi.fn().mockReturnValue({ feeConfigHash: "0xpolicy", summary: {} }),
    cancel: vi.fn().mockResolvedValue({ status: "CANCELED", transaction_hash: "0x" }),
    topUp: vi.fn().mockResolvedValue("0xtopup"),
  } satisfies TransactionKit;
}

describe("SCOUT live flow boundary", () => {
  it("uses the installed HoldToSign and real flow hook to submit once with 2 GEN", async () => {
    const kit = makeKit();
    render(
      <TransactionRunner
        kit={kit}
        client={{} as never}
        account="0x1234567890abcdef1234567890abcdef12345678"
        write={{
          kind: "write",
          address: "0x0000000000000000000000000000000000000001",
          method: "subscribe",
          args: [1n, 2n, "requirements"],
          value: payableValue,
        }}
        onSuccess={vi.fn()}
        onError={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const footer = await screen.findByRole("region", { name: "Transaction actions" });
    const button = within(footer).getByRole("button", { name: /^Hold to confirm/ });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(kit.submit).toHaveBeenCalledTimes(1));
    expect(kit.submit.mock.calls[0]?.[0].userValue).toBe(payableValue);
    expect(kit.submit.mock.calls[0]?.[1]).toMatchObject({ method: "subscribe" });
  });

  it("keeps the portaled review interactive inside the Radix modal that launched it", async () => {
    const kit = makeKit();
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Subscribe</DialogTitle>
          <DialogDescription>Review the subscription.</DialogDescription>
          <TransactionRunner
            kit={kit}
            client={{} as never}
            account="0x1234567890abcdef1234567890abcdef12345678"
            write={{
              kind: "write",
              address: "0x0000000000000000000000000000000000000001",
              method: "subscribe",
              args: [1n, 2n, "requirements"],
              value: payableValue,
            }}
            onSuccess={vi.fn()}
            onError={vi.fn()}
            onDismiss={vi.fn()}
          />
        </DialogContent>
      </Dialog>,
    );

    const branch = await screen.findByRole("dialog", { name: "SCOUT transaction" });
    expect(branch.closest(".scout-tx-portal")).toHaveStyle({ pointerEvents: "auto" });
    const button = within(branch).getByRole("button", { name: /^Hold to confirm/ });
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    await waitFor(() => expect(kit.submit).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("connects the real runner and HoldToSign to the installed kit's wallet request", async () => {
    const rawProvider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === "eth_sendTransaction")
          return "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        throw new Error(`unexpected provider method ${method}`);
      }),
    };
    const provider = instrumentWalletProvider(
      rawProvider,
      "0x1234567890abcdef1234567890abcdef12345678",
      61997,
    );
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      const result =
        body.method === "eth_getTransactionCount"
          ? "0x0"
          : body.method === "eth_estimateGas"
            ? "0x5208"
            : body.method === "eth_gasPrice"
              ? "0x1"
              : body.method === "eth_getTransactionReceipt"
                ? { status: "0x1", logs: [] }
                : null;
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const installedKit = createTransactionKit({
      chain: studioNext,
      provider,
      account: "0x1234567890abcdef1234567890abcdef12345678",
    });
    const kit = {
      ...installedKit,
      estimate: vi.fn().mockResolvedValue(quote),
      track: vi.fn().mockResolvedValue({
        phase: "decided",
        genlayerTxId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        statusName: "ACCEPTED",
        executionResultName: "FINISHED_WITH_RETURN",
        successful: true,
      } satisfies TrackedStatus),
    } satisfies TransactionKit;

    render(
      <TransactionRunner
        kit={kit}
        client={{} as never}
        account="0x1234567890abcdef1234567890abcdef12345678"
        write={{
          kind: "write",
          address: "0x0000000000000000000000000000000000000001",
          method: "subscribe",
          args: [1n, 2n, "requirements"],
          value: payableValue,
        }}
        onSuccess={vi.fn()}
        onError={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const button = await screen.findByRole("button", { name: /^Hold to confirm/ });
    fireEvent.click(button);

    await waitFor(() =>
      expect(rawProvider.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: "eth_sendTransaction" }),
      ),
    );
    expect(rawProvider.request).toHaveBeenCalledWith({
      method: "eth_sendTransaction",
      params: [expect.objectContaining({ value: "0x1bc16d674ec80001", chainId: "0xf22d" })],
    });
    vi.unstubAllGlobals();
  });
});
