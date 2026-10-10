import type { BrowserProvider } from "./client";

export type TransactionDiagnosticEvent =
  | "TX_REVIEW_OPENED"
  | "TX_FEE_QUOTE_READY"
  | "TX_POLICY_VERIFIED"
  | "TX_CONFIRM_POINTER_RECEIVED"
  | "TX_CONFIRM_CALLBACK_CALLED"
  | "TX_APPROVE_STARTED"
  | "TX_WALLET_REQUEST_STARTED"
  | "TX_WALLET_REQUEST_RETURNED"
  | "TX_WALLET_REQUEST_REJECTED"
  | "TX_SUBMISSION_STARTED"
  | "TX_SUBMISSION_RETURNED"
  | "TX_FLOW_ERROR";

type DiagnosticValue = string | number | boolean | undefined;
export type TransactionDiagnosticMetadata = Record<string, DiagnosticValue>;

function shortAddress(value?: string) {
  return value && value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

function diagnosticError(reason: unknown) {
  if (reason instanceof Error) return reason.message.slice(0, 320);
  if (typeof reason === "string") return reason.slice(0, 320);
  if (reason && typeof reason === "object" && "message" in reason) {
    return String((reason as { message?: unknown }).message).slice(0, 320);
  }
  return String(reason).slice(0, 320);
}

export function scoutTransactionDiagnostic(
  event: TransactionDiagnosticEvent,
  metadata: TransactionDiagnosticMetadata = {},
) {
  if (!import.meta.env.DEV) return;
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    ...metadata,
  };
  // Deliberately use a structured, development-only log. Never include request
  // params, raw signatures, private keys, or wallet secrets here.
  console.debug(`[SCOUT][${event}]`, payload);
}

export function instrumentWalletProvider(
  provider: BrowserProvider,
  account: string | undefined,
  expectedChainId: number,
): BrowserProvider {
  if (!import.meta.env.DEV) return provider;
  return {
    request: async ({ method, params }) => {
      const walletMethod =
        method === "eth_sendTransaction" ||
        method === "eth_signTransaction" ||
        method === "personal_sign" ||
        method === "eth_signTypedData_v4";
      if (walletMethod) {
        scoutTransactionDiagnostic("TX_WALLET_REQUEST_STARTED", {
          method,
          expectedChainId,
          wallet: shortAddress(account),
        });
      }
      try {
        const result = await provider.request({
          method,
          ...(params === undefined ? {} : { params }),
        });
        if (walletMethod) {
          scoutTransactionDiagnostic("TX_WALLET_REQUEST_RETURNED", {
            method,
            expectedChainId,
            wallet: shortAddress(account),
            transactionId: typeof result === "string" ? result : undefined,
            resultType: typeof result,
          });
        }
        return result;
      } catch (reason) {
        if (walletMethod) {
          scoutTransactionDiagnostic("TX_WALLET_REQUEST_REJECTED", {
            method,
            expectedChainId,
            wallet: shortAddress(account),
            error: diagnosticError(reason),
          });
        }
        throw reason;
      }
    },
  };
}
