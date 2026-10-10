function collectDetails(reason: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (reason == null || depth > 4 || seen.has(reason)) return [];
  if (typeof reason === "string") return [reason];
  if (typeof reason !== "object") return [String(reason)];
  seen.add(reason);
  // Error objects from injected wallets and SDK layers are intentionally heterogeneous.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = reason as any;
  const values = [
    record.message,
    record.shortMessage,
    record.details,
    record.reason,
    record.statusName,
    record.executionResultName,
    record.txExecutionResultName,
    record.data,
    record.error,
    record.cause,
    record.code,
  ];
  return values.flatMap((value) => collectDetails(value, seen, depth + 1));
}

export function errorDetails(reason: unknown) {
  return [...new Set(collectDetails(reason))].filter(Boolean).join(" | ");
}

export function normalizeScoutError(
  reason: unknown,
  fallback = "SCOUT could not complete that request.",
) {
  const detail = errorDetails(reason);
  const normalized = detail.toLowerCase();
  if (!normalized) return fallback;
  if (/user rejected|user denied|user cancel|rejected by (?:the )?user|\b4001\b/.test(normalized))
    return "You cancelled the wallet request. No new transaction was submitted.";
  if (
    /wrong network|wrong chain|chain mismatch|unsupported chain|unknown chain|\b4902\b|chain id/.test(
      normalized,
    )
  )
    return "Switch your wallet to GenLayer Studio Next (chain 61997) to continue.";
  if (/wallet.*(?:not found|not installed)|no injected|ethereum provider/.test(normalized))
    return "No compatible browser wallet was found. Install or unlock an EIP-1193 wallet and try again.";
  if (/agent owner or operator only|buyer or provider only|not authorized/.test(normalized))
    return "This wallet is not authorized for the selected agent or delivery.";
  if (/buyer and provider control must differ/.test(normalized))
    return "The buyer and provider control addresses overlap. Choose independent agents.";
  if (/agent does not exist/.test(normalized)) return "That agent ID does not exist on SCOUT.";
  if (/service does not exist|invalid service/.test(normalized))
    return "That service is no longer available.";
  if (/service is unavailable|provider agent is inactive/.test(normalized))
    return "This service or its provider is inactive. Refresh the marketplace.";
  if (/subscription does not exist/.test(normalized))
    return "That subscription was not found. Refresh the page.";
  if (/subscription inactive|subscription has expired|subscription is not active/.test(normalized))
    return "This subscription is no longer active and cannot accept that action.";
  if (/subscription escrow is insufficient/.test(normalized))
    return "This subscription does not have enough available GEN to reserve another alert.";
  if (/funding exceeds maximum total spend|maximum total spend|spending limit/.test(normalized))
    return "That amount exceeds the subscription's frozen total-spend limit.";
  if (/maximum paid alerts|paid alert|payment conditions/.test(normalized))
    return "This subscription has reached its frozen paid-alert capacity.";
  if (/submission limit reached/.test(normalized))
    return "This subscription has reached its maximum submission limit.";
  if (/duplicate report id|duplicate.*sha-256|duplicate report.*url/.test(normalized))
    return "This subscription already contains that report identifier, URL, or SHA-256 digest.";
  if (/report.*sha-256/.test(normalized))
    return "Enter the lowercase SHA-256 digest of the exact raw report bytes.";
  if (/report url|report.*https/.test(normalized))
    return "The report URL must be a public HTTPS URL without credentials, fragments, or unsupported ports.";
  if (/report id/.test(normalized))
    return "Use a unique report identifier without whitespace; the report JSON event_id must match it.";
  if (/event id|report id/.test(normalized))
    return "Use a unique report identifier without whitespace; the report JSON event_id must match it.";
  if (/evidence.*sha-256|report.*sha-256/.test(normalized))
    return "Enter the lowercase SHA-256 digest of the exact raw report bytes.";
  if (/evidence.*(?:https|url)|report.*(?:https|url)/.test(normalized))
    return "The report URL must be a public HTTPS URL without credentials, fragments, or unsupported ports.";
  if (/duplicate event|duplicate.*source|duplicate report/.test(normalized))
    return "This subscription already contains that report identifier, URL, or SHA-256 digest.";
  if (/delivery does not exist/.test(normalized))
    return "That delivery was not found. Refresh the page.";
  if (/delivery is already settled/.test(normalized))
    return "This delivery has already reached a terminal state.";
  if (/evaluation retry is delayed/.test(normalized))
    return "This delivery is not eligible for another evaluation yet. Wait for the retry window.";
  if (/evaluation retry limit reached|not ready for inconclusive/.test(normalized))
    return "This delivery has no remaining evaluation or recovery action.";
  if (/delivery is not ready for recovery/.test(normalized))
    return "Recovery is available only after cancellation/expiry and the contract's recovery delay.";
  if (/no refundable escrow|not refundable/.test(normalized))
    return "Only unreserved escrow from a cancelled or expired subscription can be withdrawn.";
  if (
    /finished_with_error|execution.*(?:error|failed)|failed to execute|execution reverted/.test(
      normalized,
    )
  )
    return "The transaction reached GenLayer but the contract execution failed. Inspect the receipt before retrying.";
  if (/undetermined|validator|consensus/.test(normalized))
    return "GenLayer did not reach a confirmed decision. Check the existing transaction before retrying.";
  if (
    /insufficient funds|insufficient balance|not enough (?:gen|funds)|fee.*(?:balance|funds)/.test(
      normalized,
    )
  )
    return "Your wallet does not have enough GEN for the escrow value and network fee deposit.";
  if (
    /fee policy|fee estimate|failed to estimate|gas estimate|external.message fee/.test(normalized)
  )
    return "SCOUT could not verify a current Studio Next fee estimate. Re-estimate before signing.";
  if (
    /failed to fetch|fetch failed|network error|connection error|transport|rpc|unavailable|timeout/.test(
      normalized,
    )
  )
    return "SCOUT could not reach Studio Next. Check your connection and retry the read or tracking request.";
  return `${fallback} ${detail.slice(0, 240)}`;
}
