import { createTransactionKit, type PolicyQuote } from "@genlayer/transaction-kit";
import { describe, expect, it, vi } from "vitest";
import { studioNext } from "./network";

const account = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;
const evmHash =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;

function quote(): PolicyQuote {
  return {
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
    userValue: 2_000_000_000_000_000_000n,
    total: 2_000_000_000_000_000_001n,
    source: "network-default",
    verification: { status: "verified" },
    breakdown: { timeUnitFees: 1n, executionBudget: 0n, messageFees: 0n },
    caps: { genPerTimeUnit: 1n, storagePrice: 1n, receiptPrice: 1n },
    refundable: true,
  };
}

describe("installed GenLayer Transaction Kit submission path", () => {
  it("reaches the injected eth_sendTransaction request with the exact payable value", async () => {
    const provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === "eth_sendTransaction") return evmHash;
        throw new Error(`unexpected wallet method ${method}`);
      }),
    };
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

    const kit = createTransactionKit({ chain: studioNext, provider, account });
    const result = await kit.submit(quote(), {
      kind: "write",
      address: "0x0000000000000000000000000000000000000001",
      method: "subscribe",
      args: [1n, 2n, "requirements"],
    });

    expect(result.evmTxHash).toBe(evmHash);
    expect(provider.request).toHaveBeenCalledWith({
      method: "eth_sendTransaction",
      params: [
        expect.objectContaining({
          from: account,
          // The wallet request carries protocol value + the quoted fee deposit.
          // The quote's userValue above remains exactly 2 GEN.
          value: "0x1bc16d674ec80001",
          chainId: "0xf22d",
        }),
      ],
    });
    vi.unstubAllGlobals();
  });
});
