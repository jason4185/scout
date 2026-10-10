import { studioDevnet } from "genlayer-js/chains";
import type { GenLayerChain } from "@genlayer/transaction-kit";
import { isAddress, type Address } from "viem";

export const STUDIO_NEXT_CHAIN_ID = 61997;
export const STUDIO_NEXT_RPC_URL =
  (import.meta.env["VITE_GENLAYER_RPC_URL"] as string | undefined) ?? "";
export const STUDIO_NEXT_EXPLORER_URL = "https://explorer-studio-dev.genlayer.com";
const configuredContract = import.meta.env["VITE_SCOUT_CONTRACT_ADDRESS"] as string | undefined;
export const SCOUT_CONTRACT_ADDRESS = (
  configuredContract && isAddress(configuredContract)
    ? configuredContract
    : "0x0000000000000000000000000000000000000000"
) as Address;

const configuredChain = import.meta.env["VITE_GENLAYER_CHAIN_ID"] as string | undefined;
const parsedChain = configuredChain ? Number(configuredChain) : Number.NaN;
export const GENLAYER_CONFIG_ERROR = [
  configuredChain && Number.isSafeInteger(parsedChain) && parsedChain === STUDIO_NEXT_CHAIN_ID
    ? undefined
    : `VITE_GENLAYER_CHAIN_ID must be ${STUDIO_NEXT_CHAIN_ID}.`,
  STUDIO_NEXT_RPC_URL
    ? STUDIO_NEXT_RPC_URL.startsWith("https://")
      ? undefined
      : "Studio Next RPC must use HTTPS."
    : "VITE_GENLAYER_RPC_URL is missing.",
  isAddress(SCOUT_CONTRACT_ADDRESS) &&
  SCOUT_CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000"
    ? undefined
    : "SCOUT contract address is missing or invalid.",
]
  .filter((item): item is string => Boolean(item))
  .join(" ");

export const studioNext = {
  ...studioDevnet,
  id: STUDIO_NEXT_CHAIN_ID,
  name: "GenLayer Studio Next",
  rpcUrls: { default: { http: [STUDIO_NEXT_RPC_URL] } },
  blockExplorers: {
    default: { name: "GenLayer Studio Explorer", url: STUDIO_NEXT_EXPLORER_URL },
  },
} satisfies GenLayerChain;

export const studioNextChainIdHex = `0x${STUDIO_NEXT_CHAIN_ID.toString(16)}`;

export function explorerTransactionUrl(txId: string) {
  return `${STUDIO_NEXT_EXPLORER_URL}/tx/${txId}`;
}

export function explorerAddressUrl(address: string) {
  return `${STUDIO_NEXT_EXPLORER_URL}/address/${address}`;
}

export function assertGenLayerConfiguration() {
  if (GENLAYER_CONFIG_ERROR) throw new Error(GENLAYER_CONFIG_ERROR);
}
