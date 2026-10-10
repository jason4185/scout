import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@genlayer/transaction-kit", () => ({
  createTransactionKit: vi.fn(() => ({})),
}));

vi.mock("./network", () => ({
  assertGenLayerConfiguration: vi.fn(),
  GENLAYER_CONFIG_ERROR: "VITE_SCOUT_CONTRACT_ADDRESS is missing.",
  GENLAYER_NETWORK_CONFIG_ERROR: "",
  STUDIO_NEXT_CHAIN_ID: 61997,
  STUDIO_NEXT_EXPLORER_URL: "https://explorer-studio-dev.genlayer.com",
  STUDIO_NEXT_RPC_URL: "https://studio-next.genlayer.com/api",
  explorerAddressUrl: (address: string) =>
    `https://explorer-studio-dev.genlayer.com/address/${address}`,
  studioNext: {
    id: 61997,
    name: "GenLayer Studio Next",
    nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
    rpcUrls: { default: { http: ["https://studio-next.genlayer.com/api"] } },
  },
  studioNextChainIdHex: "0xf22d",
}));

import { WalletControl, WalletProvider } from "./wallet";
import { getInjectedProvider } from "./client";

const ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

type FakeWallet = {
  request: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
};

function installWallet(request: FakeWallet["request"]) {
  const wallet: FakeWallet = {
    request,
    on: vi.fn(),
    removeListener: vi.fn(),
  };
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: wallet,
  });
  return wallet;
}

function renderControl() {
  return render(
    <WalletProvider>
      <WalletControl />
    </WalletProvider>,
  );
}

afterEach(() => {
  Reflect.deleteProperty(window, "ethereum");
  vi.restoreAllMocks();
});

describe("SCOUT wallet connection", () => {
  it("does not access an injected provider during SSR", () => {
    const originalWindow = globalThis.window;
    vi.stubGlobal("window", undefined);
    expect(getInjectedProvider()).toBeUndefined();
    vi.stubGlobal("window", originalWindow);
  });

  it("reports a missing browser wallet visibly", async () => {
    renderControl();

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Install an injected EIP-1193 wallet such as MetaMask to connect.",
    );
  });

  it("requests accounts even when contract configuration is missing", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_accounts") return [ADDRESS];
      if (method === "eth_chainId") return "0xf22d";
      if (method === "eth_getBalance") return "0xde0b6b3a7640000";
      if (method === "eth_requestAccounts") return [ADDRESS];
      return null;
    });
    installWallet(request);
    renderControl();

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open connected wallet" })).toBeInTheDocument(),
    );
    expect(request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
    expect(screen.getByRole("button", { name: "Open connected wallet" })).toHaveTextContent(
      "0x1234…5678",
    );
    fireEvent.click(screen.getByRole("button", { name: "Open connected wallet" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Wallet connected, but this deployment is missing required SCOUT configuration.",
    );
  });

  it("shows a useful message when the wallet rejects authorization", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_accounts") return [];
      if (method === "eth_chainId") return "0xf22d";
      if (method === "eth_requestAccounts") throw { code: 4001, message: "User rejected" };
      return null;
    });
    installWallet(request);
    renderControl();

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You cancelled the wallet request. No new transaction was submitted.",
    );
  });

  it("offers Studio Next switching and refreshes after the chain changes", async () => {
    let chainId = "0x1";
    const request = vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === "eth_accounts") return [ADDRESS];
      if (method === "eth_chainId") return chainId;
      if (method === "eth_getBalance") return "0x0";
      if (method === "wallet_switchEthereumChain") {
        expect(params).toEqual([{ chainId: "0xf22d" }]);
        chainId = "0xf22d";
        return null;
      }
      return null;
    });
    installWallet(request);
    renderControl();

    expect(
      await screen.findByRole("button", { name: "Switch to Studio Next" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Studio Next" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open connected wallet" })).toBeInTheDocument(),
    );
    expect(request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xf22d" }],
    });
  });
});
