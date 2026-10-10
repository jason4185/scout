import {
  CapsShield,
  FeeReceipt,
  HoldToSign,
  PresetSelector,
  Timeline,
  VerifyBadge,
  useTransactionFlow,
} from "@genlayer/transaction-kit-react";
import type {
  PolicyQuote,
  SubmitInput,
  TrackedStatus,
  TransactionKit,
} from "@genlayer/transaction-kit";
import { DismissableLayerBranch } from "@radix-ui/react-dismissable-layer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import { isSuccessful } from "genlayer-js";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { GenLayerClient } from "./client";
import { scoutTransactionDiagnostic } from "./diagnostics";
import { errorDetails, normalizeScoutError } from "./errors";
import type { ContractWrite } from "./scout";
import { explorerTransactionUrl, STUDIO_NEXT_CHAIN_ID } from "./network";

export async function verifySuccessfulTransaction(status: TrackedStatus, client: GenLayerClient) {
  if (!status.genlayerTxId) throw new Error("Studio Next did not return a transaction ID.");
  if (status.successful === true) return status.genlayerTxId;
  if (status.successful === false)
    throw new Error(
      `Transaction execution failed: ${status.executionResultName ?? status.statusName ?? "unknown outcome"}.`,
    );
  const transaction = await client.getTransaction({ hash: status.genlayerTxId as never });
  if (!isSuccessful(transaction))
    throw new Error(
      `Transaction execution failed: ${transaction.txExecutionResultName ?? transaction.statusName ?? "unknown outcome"}.`,
    );
  return status.genlayerTxId;
}

function leaderRounds(distribution: PolicyQuote["distribution"]) {
  return distribution.rotations.reduce((total, rotations) => total + rotations + 1n, 1n);
}

function withExternalMessageFees(baseKit: TransactionKit, client: GenLayerClient): TransactionKit {
  const externalTransfers = new Set(["evaluate_delivery", "withdraw_subscription_refund"]);
  const isExternalTransfer = (
    tx: SubmitInput | undefined,
  ): tx is Extract<SubmitInput, { kind: "write" }> =>
    tx?.kind === "write" && externalTransfers.has(tx.method);
  return {
    ...(baseKit.allowUnverified ? { allowUnverified: true } : {}),
    estimate: async (input, tx) => {
      const baseQuote = await baseKit.estimate(input, tx);
      if (!isExternalTransfer(tx)) return baseQuote;
      const distribution = baseQuote.distribution;
      const measured = await client.estimateTransactionFeesForWrite({
        address: tx.address,
        functionName: tx.method,
        ...(tx.args === undefined ? {} : { args: tx.args as never[] }),
        value: baseQuote.userValue,
        leaderTimeunitsAllocation: distribution.leaderTimeunitsAllocation,
        validatorTimeunitsAllocation: distribution.validatorTimeunitsAllocation,
        appealRounds: distribution.appealRounds,
        executionBudgetPerRound: distribution.executionBudgetPerRound,
        totalMessageFees: distribution.totalMessageFees,
        rotations: distribution.rotations,
        maxPriceGenPerTimeUnit: distribution.maxPriceGenPerTimeUnit,
        storageFeeMaxGasPrice: distribution.storageFeeMaxGasPrice,
        receiptFeeMaxGasPrice: distribution.receiptFeeMaxGasPrice,
      });
      if (!measured.messageAllocations?.length)
        throw new Error(`No external-message fee allocation was returned for ${tx.method}.`);
      const executionBudget =
        measured.distribution.executionBudgetPerRound * leaderRounds(measured.distribution);
      const messageFees = measured.distribution.totalMessageFees;
      return {
        ...baseQuote,
        distribution: measured.distribution,
        feeValue: measured.feeValue,
        total: measured.feeValue + baseQuote.userValue,
        breakdown: {
          timeUnitFees:
            measured.feeValue - messageFees - executionBudget > 0n
              ? measured.feeValue - messageFees - executionBudget
              : 0n,
          executionBudget,
          messageFees,
        },
        caps: {
          genPerTimeUnit: measured.distribution.maxPriceGenPerTimeUnit,
          storagePrice: measured.distribution.storageFeeMaxGasPrice,
          receiptPrice: measured.distribution.receiptFeeMaxGasPrice,
        },
        messageAllocations: measured.messageAllocations,
      } as PolicyQuote & { messageAllocations: unknown[] };
    },
    submit: async (quote, tx) => {
      if (!isExternalTransfer(tx)) return baseKit.submit(quote, tx);
      const messageAllocations = (quote as PolicyQuote & { messageAllocations?: unknown[] })
        .messageAllocations;
      if (!messageAllocations?.length)
        throw new Error(`No external-message fee allocation is available for ${tx.method}.`);
      const result = await client.writeContract({
        address: tx.address,
        functionName: tx.method,
        ...(tx.args === undefined ? {} : { args: tx.args as never[] }),
        value: quote.userValue,
        fees: {
          distribution: quote.distribution,
          messageAllocations: messageAllocations as never[],
          feeValue: quote.feeValue,
        },
      });
      return { genlayerTxId: result };
    },
    cancel: baseKit.cancel,
    topUp: baseKit.topUp,
    track: baseKit.track,
    verification: baseKit.verification,
  };
}

function TransactionViewport({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss?: (() => void) | undefined;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!onDismiss) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);
  if (!mounted) return null;
  return createPortal(
    <FocusScope asChild loop trapped>
      <DismissableLayerBranch className="scout-tx-portal" style={{ pointerEvents: "auto" }}>
        <div
          className="scout-tx-viewport fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="SCOUT transaction"
        >
          <div className="scout-tx-backdrop absolute inset-0 bg-black/50" aria-hidden="true" />
          <div className="scout-tx-scroll relative z-10">{children}</div>
        </div>
      </DismissableLayerBranch>
    </FocusScope>,
    document.body,
  );
}

export function ExplorerLink({ txId }: { txId: string }) {
  return (
    <a
      className="text-sm font-semibold underline underline-offset-4"
      href={explorerTransactionUrl(txId)}
      target="_blank"
      rel="noreferrer"
    >
      View transaction on Explorer
    </a>
  );
}

function methodLabel(method: string) {
  return method.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function shortAccount(address?: string) {
  return address && address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function FeeDetails({ quote, fingerprint }: { quote: PolicyQuote; fingerprint?: string }) {
  const distribution = quote.distribution;
  const fields = [
    ["Appeal rounds", distribution.appealRounds.toString()],
    ["Leader time units", distribution.leaderTimeunitsAllocation.toString()],
    ["Validator time units", distribution.validatorTimeunitsAllocation.toString()],
    ["Rotations", distribution.rotations.join(", ") || "0"],
    ["Execution budget", `${formatGen(distribution.executionBudgetPerRound)} GEN / round`],
    ["Message fees", `${formatGen(distribution.totalMessageFees)} GEN`],
    ["Time-unit price cap", `${formatGen(distribution.maxPriceGenPerTimeUnit)} GEN`],
    ["Storage price cap", `${distribution.storageFeeMaxGasPrice.toString()} wei`],
    ["Receipt gas cap", `${distribution.receiptFeeMaxGasPrice.toString()} wei`],
    ["Policy fingerprint", fingerprint ?? quote.verification.expectedHash ?? "Unavailable"],
  ];
  return (
    <details className="gltk-advanced scout-tx-advanced">
      <summary>Advanced fee details</summary>
      <div className="gltk-advanced-grid">
        {fields.map(([label, value]) => (
          <div className="gltk-field scout-tx-fee-field" key={label}>
            <span>{label}</span>
            <code title={value}>{value}</code>
          </div>
        ))}
      </div>
    </details>
  );
}

export function TransactionRunner({
  kit,
  client,
  account,
  write,
  onSuccess,
  onError,
  onDismiss,
  intro,
  label = "Continue",
  onFinalized,
}: {
  kit: TransactionKit;
  client: GenLayerClient;
  account?: string | undefined;
  write: ContractWrite;
  onSuccess: (txId: string) => void | Promise<void>;
  onError: (error: Error) => void;
  onDismiss?: () => void;
  intro?: ReactNode;
  label?: string;
  onFinalized?: (status: TrackedStatus) => void | Promise<void>;
}) {
  const argsKey = write.args.map(String).join("|");
  const argsRef = useRef({ key: argsKey, args: write.args });
  if (argsRef.current.key !== argsKey) argsRef.current = { key: argsKey, args: write.args };
  const stableArgs = argsRef.current.args;
  const transactionKit = useMemo(() => withExternalMessageFees(kit, client), [client, kit]);
  const diagnosticKit = useMemo(() => {
    const base = transactionKit;
    return {
      ...base,
      estimate: async (...args: Parameters<typeof base.estimate>) => {
        try {
          const quote = await base.estimate(...args);
          scoutTransactionDiagnostic("TX_FEE_QUOTE_READY", {
            method: write.method,
            expectedChainId: STUDIO_NEXT_CHAIN_ID,
            wallet: shortAccount(account),
            quoteAvailable: true,
            protocolValueWei: quote.userValue.toString(),
            feeValueWei: quote.feeValue.toString(),
          });
          return quote;
        } catch (reason) {
          scoutTransactionDiagnostic("TX_FLOW_ERROR", {
            method: write.method,
            stage: "fee_estimate",
            error: normalizeScoutError(reason),
          });
          throw reason;
        }
      },
      submit: async (...args: Parameters<typeof base.submit>) => {
        const [quote, tx] = args;
        scoutTransactionDiagnostic("TX_SUBMISSION_STARTED", {
          method: tx.kind === "write" ? tx.method : "deploy",
          expectedChainId: STUDIO_NEXT_CHAIN_ID,
          wallet: shortAccount(account),
          protocolValueWei: quote.userValue.toString(),
          feeValueWei: quote.feeValue.toString(),
        });
        try {
          const result = await base.submit(...args);
          scoutTransactionDiagnostic("TX_SUBMISSION_RETURNED", {
            method: tx.kind === "write" ? tx.method : "deploy",
            genlayerTxId: result.genlayerTxId,
            evmTxHash: result.evmTxHash,
          });
          return result;
        } catch (reason) {
          scoutTransactionDiagnostic("TX_FLOW_ERROR", {
            method: tx.kind === "write" ? tx.method : "deploy",
            stage: "submission",
            error: normalizeScoutError(reason),
          });
          throw reason;
        }
      },
    };
  }, [account, transactionKit, write.method]);
  const flow = useTransactionFlow({
    kit: diagnosticKit,
    tx: useMemo(
      () => ({
        kind: "write" as const,
        address: write.address,
        method: write.method,
        args: stableArgs,
      }),
      [stableArgs, write.address, write.method],
    ),
    trackUntil: "decided",
    ...(write.value === undefined ? {} : { userValue: write.value }),
  });
  const [txId, setTxId] = useState<string>();
  const [childTxIds, setChildTxIds] = useState<string[]>([]);
  const [verificationError, setVerificationError] = useState<string>();
  const [resuming, setResuming] = useState(false);
  const [resumedStatus, setResumedStatus] = useState<TrackedStatus>();
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [interactionError, setInteractionError] = useState<string>();
  const handled = useRef("");
  const reported = useRef("");
  const diagnosticState = useRef("");
  const approvalInFlight = useRef(false);
  const state = flow.state;
  const pendingKey = `scout:pending:${write.address}:${write.method}:${argsKey}`;

  useEffect(() => {
    scoutTransactionDiagnostic("TX_REVIEW_OPENED", {
      method: write.method,
      expectedChainId: STUDIO_NEXT_CHAIN_ID,
      wallet: shortAccount(account),
      protocolValueWei: write.value?.toString() ?? "0",
    });
  }, [account, write.method, write.value]);

  useEffect(() => {
    const stateKey = `${state.step}:${state.step === "error" ? state.message : ""}`;
    if (diagnosticState.current === stateKey) return;
    diagnosticState.current = stateKey;
    if (state.step === "review" && state.quote) {
      scoutTransactionDiagnostic("TX_POLICY_VERIFIED", {
        method: write.method,
        policyState: state.quote.verification.status,
        feeConfigHash: flow.verification?.feeConfigHash,
      });
    }
    if (state.step === "error") {
      scoutTransactionDiagnostic("TX_FLOW_ERROR", {
        method: write.method,
        stage: "flow",
        error: normalizeScoutError(state.message),
      });
    }
    if (state.step !== "signing") approvalInFlight.current = false;
  }, [account, flow.verification?.feeConfigHash, state, write.method]);

  const handleConfirmPointer = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.closest(".gltk-hold")) return;
    scoutTransactionDiagnostic("TX_CONFIRM_POINTER_RECEIVED", {
      method: write.method,
      pointerType: event.pointerType,
      button: event.button,
      disabled: (target.closest(".gltk-hold") as HTMLButtonElement | null)?.disabled ?? false,
    });
  };

  const handleConfirm = () => {
    scoutTransactionDiagnostic("TX_CONFIRM_CALLBACK_CALLED", {
      method: write.method,
      flowStep: state.step,
      quoteAvailable: Boolean(flow.quote),
      policyState: flow.quote?.verification.status,
    });
    if (approvalInFlight.current) return;
    if (state.step !== "review" || !flow.quote) {
      const message =
        "The transaction review is no longer ready. Re-estimate the fee quote before signing.";
      setInteractionError(message);
      scoutTransactionDiagnostic("TX_FLOW_ERROR", {
        method: write.method,
        stage: "approve_guard",
        error: message,
      });
      return;
    }
    approvalInFlight.current = true;
    setInteractionError(undefined);
    scoutTransactionDiagnostic("TX_APPROVE_STARTED", {
      method: write.method,
      expectedChainId: STUDIO_NEXT_CHAIN_ID,
      wallet: shortAccount(account),
      protocolValueWei: flow.quote.userValue.toString(),
      feeValueWei: flow.quote.feeValue.toString(),
      policyState: flow.quote.verification.status,
    });
    void flow.approve().catch((reason) => {
      approvalInFlight.current = false;
      const message = normalizeScoutError(reason);
      setInteractionError(message);
      scoutTransactionDiagnostic("TX_FLOW_ERROR", {
        method: write.method,
        stage: "approve",
        error: message,
      });
    });
  };

  useEffect(() => {
    if (state.step === "tracking" && state.status.genlayerTxId) {
      setTxId(state.status.genlayerTxId);
      if (typeof window !== "undefined")
        window.localStorage.setItem(pendingKey, state.status.genlayerTxId);
    }
  }, [pendingKey, state]);

  useEffect(() => {
    if (txId || typeof window === "undefined") return;
    const cached = window.localStorage.getItem(pendingKey);
    if (cached) setTxId(cached);
  }, [pendingKey, txId]);

  useEffect(() => {
    if (state.step === "error") {
      if (reported.current !== state.message) {
        reported.current = state.message;
        onError(new Error(normalizeScoutError(state.message)));
      }
      return;
    }
    reported.current = "";
    if (
      state.step !== "done" ||
      !state.status.genlayerTxId ||
      handled.current === state.status.genlayerTxId
    )
      return;
    handled.current = state.status.genlayerTxId;
    setTxId(state.status.genlayerTxId);
    void verifySuccessfulTransaction(state.status, client)
      .then(async (id) => {
        if (typeof window !== "undefined") window.localStorage.removeItem(pendingKey);
        try {
          const children = await client.getTriggeredTransactionIds({ hash: id as never });
          if (Array.isArray(children)) setChildTxIds(children.map(String));
        } catch {
          /* Some Studio deployments expose child IDs only after finalization. */
        }
        void transactionKit
          .track(
            id as `0x${string}`,
            async (status) => {
              if (status.phase === "finalized") {
                try {
                  const children = await client.getTriggeredTransactionIds({ hash: id as never });
                  if (Array.isArray(children)) setChildTxIds(children.map(String));
                } catch {
                  /* Receipt enrichment is optional. */
                }
                void onFinalized?.(status);
              }
            },
            { until: "finalized" },
          )
          .catch(() => undefined);
        await onSuccess(id);
      })
      .catch((reason) => {
        const message = normalizeScoutError(reason);
        setVerificationError(message);
        onError(new Error(message));
      });
  }, [client, onError, onFinalized, onSuccess, pendingKey, state, transactionKit]);

  const resumeTracking = async () => {
    if (!txId) return;
    setResuming(true);
    setVerificationError(undefined);
    try {
      const status = await transactionKit.track(
        txId as `0x${string}`,
        (next) => setResumedStatus(next),
        { until: "decided" },
      );
      setResumedStatus(status);
      const id = await verifySuccessfulTransaction(status, client);
      if (typeof window !== "undefined") window.localStorage.removeItem(pendingKey);
      await onSuccess(id);
    } catch (reason) {
      const message = normalizeScoutError(reason);
      setVerificationError(message);
      onError(new Error(message));
    } finally {
      setResuming(false);
    }
  };

  const retry = () => {
    setVerificationError(undefined);
    setInteractionError(undefined);
    handled.current = "";
    flow.reset();
  };
  const copyAccount = () => {
    if (!account || typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard
      .writeText(account)
      .then(() => {
        setCopiedAccount(true);
        window.setTimeout(() => setCopiedAccount(false), 1600);
      })
      .catch(() => undefined);
  };
  const showError =
    state.step === "error" || Boolean(verificationError) || Boolean(interactionError);
  const reviewState = state.step === "review" || state.step === "blocked";
  const footerVisible =
    reviewState || state.step === "estimating" || state.step === "tracking" || showError;
  const actionFooter = footerVisible ? (
    <div className="scout-tx-footer" role="region" aria-label="Transaction actions">
      {reviewState && (
        <div className="gltk-actions scout-tx-footer-actions">
          {state.step === "blocked" ? (
            <button type="button" onClick={retry}>
              Re-estimate
            </button>
          ) : (
            <HoldToSign onConfirm={handleConfirm} disabled={!flow.quote} label="Hold to confirm" />
          )}
        </div>
      )}
      {state.step === "review" && flow.quote && (
        <p className="scout-tx-hold-note">
          Click once on desktop. On touch devices, press and hold until the progress completes.
        </p>
      )}
      {reviewState && !flow.quote && (
        <p className="scout-tx-hold-note" role="status">
          Waiting for the live fee estimate before signing is enabled.
        </p>
      )}
      {(reviewState || state.step === "estimating") && onDismiss && (
        <div className="gltk-link-row scout-tx-footer-cancel">
          <button type="button" onClick={onDismiss}>
            Cancel
          </button>
        </div>
      )}
      {state.step === "tracking" && (flow.canTopUp || flow.canCancel) && (
        <div className="gltk-actions scout-tx-footer-actions">
          {flow.canTopUp && (
            <button type="button" onClick={() => void flow.topUp()}>
              Top up fees
            </button>
          )}
          {flow.canCancel && (
            <button type="button" onClick={() => void flow.cancel()}>
              Cancel transaction
            </button>
          )}
        </div>
      )}
      {showError && (
        <div className="gltk-actions scout-tx-footer-actions">
          {state.step === "error" && txId && !resuming ? (
            <button type="button" onClick={() => void resumeTracking()}>
              Track existing transaction
            </button>
          ) : state.step === "error" && !resuming ? (
            <button type="button" onClick={retry}>
              Re-estimate and retry
            </button>
          ) : null}
          <button type="button" onClick={() => onDismiss?.()}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  ) : null;
  const content = (
    <div className="scout-tx-modal" onPointerDownCapture={handleConfirmPointer}>
      <div className="scout-tx-titlebar">
        <div className="min-w-0">
          <p className="scout-tx-eyebrow">Review transaction</p>
          <h2 className="scout-tx-action">{methodLabel(write.method)}</h2>
          <p className="scout-tx-network">{`GenLayer Studio Next · Chain ${STUDIO_NEXT_CHAIN_ID}`}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            className="scout-tx-close"
            onClick={onDismiss}
            aria-label="Close transaction review"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
      <div className="scout-tx-body">
        {intro && <div className="scout-tx-intro">{intro}</div>}
        <div className="gltk-root" data-theme="dark">
          <div className="gltk-panel">
            <div className="gltk-head">
              <span className="gltk-head-title">SCOUT TRANSACTION</span>
              <span className="gltk-head-network">Studio Next</span>
            </div>
            <div className="gltk-target">
              <span className="gltk-target-kind">Write</span>
              <span className="gltk-target-what">
                {write.method.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </div>
            <div className="scout-tx-wallet-row">
              <span>Signing wallet</span>
              <span className="scout-tx-wallet-value">
                <code title={account ?? "Connected wallet"}>
                  {shortAccount(account) ?? "Connected wallet"}
                </code>
                {account && (
                  <button type="button" className="scout-tx-copy" onClick={copyAccount}>
                    {copiedAccount ? "Copied" : "Copy"}
                  </button>
                )}
              </span>
            </div>
            <div className="gltk-receipt" aria-label="Protocol value">
              <div className="gltk-row">
                <span className="gltk-row-label">
                  Protocol value <span className="gltk-row-hint">GEN</span>
                </span>
                <span className="gltk-row-value">
                  {formatGen(write.value ?? 0n)} <span className="gltk-unit">GEN</span>
                </span>
              </div>
            </div>
            {state.step === "estimating" && (
              <div className="gltk-outcome" data-tone="warn">
                <p className="gltk-outcome-title">Preparing transaction</p>
                <p className="gltk-outcome-detail">Preparing the live Studio Next fee estimate…</p>
              </div>
            )}
            {(state.step === "review" || state.step === "blocked") && (
              <>
                {!flow.quote?.gasless && (
                  <PresetSelector value={flow.preset} onChange={flow.setPreset} />
                )}
                {flow.quote && <FeeReceipt quote={flow.quote} />}
                {flow.quote && !flow.quote.gasless && <CapsShield quote={flow.quote} />}
                {flow.quote && (
                  <VerifyBadge
                    status={flow.quote.verification.status}
                    {...(flow.verification?.feeConfigHash
                      ? { feeConfigHash: flow.verification.feeConfigHash }
                      : {})}
                  />
                )}
                {flow.quote && (
                  <FeeDetails
                    quote={flow.quote}
                    {...(flow.verification?.feeConfigHash
                      ? { fingerprint: flow.verification.feeConfigHash }
                      : {})}
                  />
                )}
                {state.step === "blocked" && (
                  <div className="gltk-outcome" data-tone="error">
                    <p className="gltk-outcome-title">Fee estimate needs review</p>
                    <p className="gltk-outcome-detail">{normalizeScoutError(state.message)}</p>
                  </div>
                )}
              </>
            )}
            {state.step === "signing" && (
              <div className="gltk-outcome" data-tone="warn">
                <p className="gltk-outcome-title">Waiting for your wallet</p>
                <p className="gltk-outcome-detail">
                  Review the request in your wallet. Rejecting it does not submit a transaction.
                </p>
              </div>
            )}
            {state.step === "tracking" && <Timeline status={state.status} />}
            {resuming && (
              <div className="gltk-outcome" data-tone="warn">
                <p className="gltk-outcome-title">Resuming existing transaction</p>
                <p className="gltk-outcome-detail">
                  Tracking {txId} without submitting a second write…
                </p>
                {resumedStatus && <Timeline status={resumedStatus} />}
              </div>
            )}
            {state.step === "done" && !verificationError && (
              <>
                <Timeline status={state.status} />
                <div className="gltk-outcome" data-tone="success">
                  <p className="gltk-outcome-title">
                    {state.status.phase === "finalized"
                      ? "Transaction finalized"
                      : "Consensus accepted"}
                  </p>
                  <p className="gltk-outcome-detail">
                    Contract execution succeeded.{" "}
                    {state.status.phase === "finalized"
                      ? "Final fee settlement is recorded."
                      : "Finalization and any external transfers may still be pending."}
                  </p>
                </div>
              </>
            )}
            {showError && (
              <>
                <div className="gltk-outcome" data-tone="error" role="alert">
                  <p className="gltk-outcome-title">The transaction was not completed</p>
                  <p className="gltk-outcome-detail">
                    {interactionError ??
                      verificationError ??
                      (state.step === "error"
                        ? normalizeScoutError(state.message)
                        : "Transaction failed during execution.")}
                  </p>
                  {state.step === "error" && (
                    <p className="mt-2 text-[10px] opacity-70">
                      {errorDetails(state.message).slice(0, 240)}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {txId && (
          <div className="scout-tx-links">
            <ExplorerLink txId={txId} />
          </div>
        )}
        {childTxIds.length > 0 && (
          <div className="scout-tx-links">
            <p>External GEN transfer messages:</p>
            {childTxIds.map((child) => (
              <ExplorerLink key={child} txId={child} />
            ))}
          </div>
        )}
        <p className="scout-tx-note">
          {label} uses the connected wallet and live Studio Next fee flow. Escrow value and network
          fee deposit are shown separately. A queued provider payout or refund is not proof of
          wallet receipt until its child transfer is independently confirmed.
        </p>
      </div>
      {actionFooter}
    </div>
  );
  return <TransactionViewport onDismiss={onDismiss}>{content}</TransactionViewport>;
}

function formatGen(wei: bigint) {
  const whole = wei / 1000000000000000000n;
  const fraction = (wei % 1000000000000000000n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
