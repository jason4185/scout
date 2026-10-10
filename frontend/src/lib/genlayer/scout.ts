import type { Address } from "viem";
import { getReadClient, type GenLayerClient } from "./client";
import {
  assertGenLayerConfiguration,
  SCOUT_CONTRACT_ADDRESS,
  STUDIO_NEXT_CHAIN_ID,
} from "./network";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RecordValue = any;

export type ContractWrite = {
  kind: "write";
  address: Address;
  method: string;
  args: unknown[];
  value?: bigint;
};
export type Page<T> = {
  offset: number;
  limit: number;
  total: number;
  nextOffset: number;
  hasMore: boolean;
  items: T[];
};
export type Agent = {
  id: string;
  owner: string;
  operator: string;
  payoutAddress: string;
  name: string;
  description: string;
  active: boolean;
  totalSubmitted: number;
  approvedAlerts: number;
  rejectedAlerts: number;
  inconclusiveEvaluations: number;
  completedDeliveries: number;
  verifiedEarningsWei: bigint;
  verifiedEarningsGen: string;
};
export type Service = {
  id: string;
  providerAgentId: string;
  name: string;
  description: string;
  category: string;
  scope: string;
  priceWei: bigint;
  priceGen: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Subscription = {
  id: string;
  buyerAgentId: string;
  providerAgentId: string;
  serviceId: string;
  providerPayout: string;
  serviceName: string;
  serviceCategory: string;
  serviceScope: string;
  requirements: string;
  allowedTopics: string;
  agreedPriceWei: bigint;
  agreedPriceGen: string;
  createdAt: number;
  expiresAt: number;
  maxPaidAlerts: number;
  maxTotalSpendWei: bigint;
  maxTotalSpendGen: string;
  maxSubmissions: number;
  state: string;
  totalFundedWei: bigint;
  availableEscrowWei: bigint;
  reservedEscrowWei: bigint;
  totalPaidWei: bigint;
  totalRefundedWei: bigint;
  paidAlerts: number;
  submittedAlerts: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};
export type Delivery = {
  id: string;
  subscriptionId: string;
  providerAgentId: string;
  reportId: string;
  reportUrl: string;
  reportSha256: string;
  metadata: string;
  submittedAt: number;
  decision: string;
  attempts: number;
  priceWei: bigint;
  priceGen: string;
  payoutStatus: string;
  settled: boolean;
  evaluatedAt: number;
};
export type ScoutConfig = {
  protocol: string;
  nativeToken: string;
  nativePrecision: number;
  chainId: number;
  maxPageSize: number;
  maxEvaluationAttempts: number;
  retryDelaySeconds: number;
  recoveryDelaySeconds: number;
  maxDuplicateContext: number;
  limits: Record<string, number>;
  statuses: Record<string, string>;
  reportPolicy: string;
  reportFormat: string;
  verification: string;
  duplicatePolicy: string;
  settlement: string;
};
export type Activity = {
  agents: number;
  services: number;
  subscriptions: number;
  deliveries: number;
  submittedAlerts: number;
  approvedAlerts: number;
  rejectedAlerts: number;
  inconclusiveEvaluations: number;
  totalFundedWei: bigint;
  totalRefundedWei: bigint;
  totalPaidWei: bigint;
};
export type BuyerEscrow = {
  buyerAgentId: string;
  totalFundedWei: bigint;
  availableEscrowWei: bigint;
  reservedEscrowWei: bigint;
};

export const SCOUT_WRITE_METHODS = [
  "register_agent",
  "update_agent_operator",
  "update_agent_payout",
  "update_agent_profile",
  "set_agent_active",
  "create_service",
  "update_service",
  "subscribe",
  "fund_subscription",
  "cancel_subscription",
  "expire_subscription",
  "withdraw_subscription_refund",
  "submit_alert",
  "evaluate_delivery",
  "resolve_inconclusive_delivery",
] as const;
export const SCOUT_VIEW_METHODS = [
  "get_config",
  "get_agent",
  "get_agents",
  "get_service",
  "get_services",
  "get_available_services",
  "get_subscription",
  "get_subscriptions_by_buyer",
  "get_subscriptions_by_provider",
  "get_delivery",
  "get_deliveries",
  "get_subscription_deliveries",
  "get_provider_deliveries",
  "get_provider_performance",
  "get_buyer_escrow",
  "get_total_activity",
] as const;

function address(): Address {
  assertGenLayerConfiguration();
  return SCOUT_CONTRACT_ADDRESS;
}
function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`SCOUT returned an invalid ${field}.`);
  return value as RecordValue;
}
function integer(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`SCOUT returned an invalid ${field}.`);
}
function numberValue(value: unknown, field: string) {
  const result = integer(value, field);
  const number = Number(result);
  if (!Number.isSafeInteger(number)) throw new Error(`SCOUT returned an unsafe ${field}.`);
  return number;
}
function stringValue(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`SCOUT returned an invalid ${field}.`);
  return value;
}
function booleanValue(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new Error(`SCOUT returned an invalid ${field}.`);
  return value;
}
function readArgs(args: unknown[]) {
  return args as never[];
}
async function read(client: GenLayerClient, method: string, args: unknown[] = []) {
  return await client.readContract({
    address: address(),
    functionName: method,
    args: readArgs(args),
    transactionHashVariant: "latest-nonfinal" as never,
  });
}
function page<T>(raw: unknown, key: string, mapper: (value: unknown) => T): Page<T> {
  const value = record(raw, `${key} page`);
  if (!Array.isArray(value[key])) throw new Error(`SCOUT returned an invalid ${key} page.`);
  return {
    offset: numberValue(value.offset, `${key} offset`),
    limit: numberValue(value.limit, `${key} limit`),
    total: numberValue(value.total, `${key} total`),
    nextOffset: numberValue(value.next_offset, `${key} next offset`),
    hasMore: booleanValue(value.has_more, `${key} pagination`),
    items: value[key].map(mapper),
  };
}
function mapAgent(raw: unknown): Agent {
  const value = record(raw, "SCOUT agent");
  const earnings = integer(value.verified_earnings, "verified earnings");
  return {
    id: String(numberValue(value.agent_id, "agent ID")),
    owner: stringValue(value.owner, "owner"),
    operator: stringValue(value.operator, "operator"),
    payoutAddress: stringValue(value.payout_address, "payout address"),
    name: stringValue(value.name, "agent name"),
    description: stringValue(value.description, "agent description"),
    active: booleanValue(value.active, "agent status"),
    totalSubmitted: numberValue(value.total_submitted, "submitted reports"),
    approvedAlerts: numberValue(value.approved_alerts, "approved reports"),
    rejectedAlerts: numberValue(value.rejected_alerts, "rejected reports"),
    inconclusiveEvaluations: numberValue(
      value.inconclusive_evaluations,
      "inconclusive evaluations",
    ),
    completedDeliveries: numberValue(value.completed_deliveries, "completed deliveries"),
    verifiedEarningsWei: earnings,
    verifiedEarningsGen: formatGen(earnings),
  };
}
function mapService(raw: unknown): Service {
  const value = record(raw, "SCOUT service");
  const price = integer(value.price_per_alert, "service price");
  return {
    id: String(numberValue(value.service_id, "service ID")),
    providerAgentId: String(numberValue(value.provider_agent_id, "provider agent ID")),
    name: stringValue(value.name, "service name"),
    description: stringValue(value.description, "service description"),
    category: stringValue(value.category, "category"),
    scope: stringValue(value.scope, "scope"),
    priceWei: price,
    priceGen: formatGen(price),
    active: booleanValue(value.active, "service status"),
    createdAt: numberValue(value.created_at, "creation time"),
    updatedAt: numberValue(value.updated_at, "update time"),
  };
}
function mapSubscription(raw: unknown): Subscription {
  const value = record(raw, "SCOUT subscription");
  const price = integer(value.agreed_price, "SCOUT agreed price");
  const spend = integer(value.max_total_spend, "SCOUT maximum spend");
  return {
    id: String(numberValue(value.subscription_id, "subscription ID")),
    buyerAgentId: String(numberValue(value.buyer_agent_id, "buyer agent ID")),
    providerAgentId: String(numberValue(value.provider_agent_id, "provider agent ID")),
    serviceId: String(numberValue(value.service_id, "service ID")),
    providerPayout: stringValue(value.provider_payout, "provider payout"),
    serviceName: stringValue(value.service_name, "service name"),
    serviceCategory: stringValue(value.service_category, "service category"),
    serviceScope: stringValue(value.service_scope, "service scope"),
    requirements: stringValue(value.requirements, "requirements"),
    allowedTopics: stringValue(value.allowed_topics, "allowed topics"),
    agreedPriceWei: price,
    agreedPriceGen: formatGen(price),
    createdAt: numberValue(value.created_at, "creation time"),
    expiresAt: numberValue(value.expires_at, "expiry"),
    maxPaidAlerts: numberValue(value.max_paid_alerts, "maximum paid reports"),
    maxTotalSpendWei: spend,
    maxTotalSpendGen: formatGen(spend),
    maxSubmissions: numberValue(value.max_submissions, "maximum submissions"),
    state: stringValue(value.state, "subscription state"),
    totalFundedWei: integer(value.total_funded, "total funded"),
    availableEscrowWei: integer(value.available_escrow, "available escrow"),
    reservedEscrowWei: integer(value.reserved_escrow, "reserved escrow"),
    totalPaidWei: integer(value.total_paid, "total paid"),
    totalRefundedWei: integer(value.total_refunded, "total refunded"),
    paidAlerts: numberValue(value.paid_alerts, "paid reports"),
    submittedAlerts: numberValue(value.submitted_alerts, "submitted reports"),
    pendingCount: numberValue(value.pending_count, "pending reports"),
    approvedCount: numberValue(value.approved_count, "approved reports"),
    rejectedCount: numberValue(value.rejected_count, "rejected reports"),
  };
}
function mapDelivery(raw: unknown): Delivery {
  const value = record(raw, "SCOUT delivery");
  const price = integer(value.price, "delivery price");
  return {
    id: String(numberValue(value.delivery_id, "delivery ID")),
    subscriptionId: String(numberValue(value.subscription_id, "subscription ID")),
    providerAgentId: String(numberValue(value.provider_agent_id, "provider agent ID")),
    reportId: stringValue(value.report_id, "report ID"),
    reportUrl: stringValue(value.report_url, "report URL"),
    reportSha256: stringValue(value.report_sha256, "report hash"),
    metadata: stringValue(value.metadata, "metadata"),
    submittedAt: numberValue(value.submitted_at, "submission time"),
    decision: stringValue(value.decision, "decision"),
    attempts: numberValue(value.attempts, "evaluation attempts"),
    priceWei: price,
    priceGen: formatGen(price),
    payoutStatus: stringValue(value.payout_status, "payout status"),
    settled: booleanValue(value.settled, "settlement"),
    evaluatedAt: numberValue(value.evaluated_at, "evaluation time"),
  };
}
function mapConfig(raw: unknown): ScoutConfig {
  const value = record(raw, "SCOUT config");
  const mapNumbers = (key: string) => {
    const nested = record(value[key], key);
    return Object.fromEntries(
      Object.entries(nested).map(([name, item]) => [name, numberValue(item, `${key}.${name}`)]),
    );
  };
  const mapStrings = (key: string) => {
    const nested = record(value[key], key);
    return Object.fromEntries(
      Object.entries(nested).map(([name, item]) => [name, stringValue(item, `${key}.${name}`)]),
    );
  };
  return {
    protocol: stringValue(value.protocol, "protocol"),
    nativeToken: stringValue(value.native_token, "native token"),
    nativePrecision: numberValue(value.native_precision, "native precision"),
    chainId: numberValue(value.chain_id, "chain ID"),
    maxPageSize: numberValue(value.max_page_size, "page size"),
    maxEvaluationAttempts: numberValue(value.max_evaluation_attempts, "evaluation attempts"),
    retryDelaySeconds: numberValue(value.retry_delay_seconds, "retry delay"),
    recoveryDelaySeconds: numberValue(value.recovery_delay_seconds, "recovery delay"),
    maxDuplicateContext: numberValue(value.max_duplicate_context, "duplicate context"),
    limits: mapNumbers("limits"),
    statuses: mapStrings("statuses"),
    reportPolicy: stringValue(value.report_policy, "report policy"),
    reportFormat: stringValue(value.report_format, "report format"),
    verification: stringValue(value.verification, "verification policy"),
    duplicatePolicy: stringValue(value.duplicate_policy, "duplicate policy"),
    settlement: stringValue(value.settlement, "settlement policy"),
  };
}
function mapActivity(raw: unknown): Activity {
  const value = record(raw, "SCOUT activity");
  return {
    agents: numberValue(value.agents, "agents"),
    services: numberValue(value.services, "services"),
    subscriptions: numberValue(value.subscriptions, "subscriptions"),
    deliveries: numberValue(value.deliveries, "deliveries"),
    submittedAlerts: numberValue(value.submitted_alerts, "submitted reports"),
    approvedAlerts: numberValue(value.approved_alerts, "approved reports"),
    rejectedAlerts: numberValue(value.rejected_alerts, "rejected reports"),
    inconclusiveEvaluations: numberValue(
      value.inconclusive_evaluations,
      "inconclusive evaluations",
    ),
    totalFundedWei: integer(value.total_funded, "total funded"),
    totalRefundedWei: integer(value.total_refunded, "total refunded"),
    totalPaidWei: integer(value.total_paid, "total paid"),
  };
}
function mapEscrow(raw: unknown): BuyerEscrow {
  const value = record(raw, "SCOUT escrow");
  return {
    buyerAgentId: String(numberValue(value.buyer_agent_id, "buyer agent ID")),
    totalFundedWei: integer(value.total_funded, "funded"),
    availableEscrowWei: integer(value.available_escrow, "available escrow"),
    reservedEscrowWei: integer(value.reserved_escrow, "reserved escrow"),
  };
}

export function formatGen(wei: bigint) {
  const whole = wei / 1000000000000000000n;
  const fraction = (wei % 1000000000000000000n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
export function parseGenAmount(value: string) {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(normalized))
    throw new Error("Enter a GEN amount with no more than 18 decimal places.");
  const [whole = "0", fraction = ""] = normalized.split(".");
  return BigInt(whole) * 1000000000000000000n + BigInt(fraction.padEnd(18, "0") || "0");
}

export async function getConfig(client = getReadClient()) {
  return mapConfig(await read(client, "get_config"));
}
export async function getAgent(agentId: string, client = getReadClient()) {
  return mapAgent(await read(client, "get_agent", [BigInt(agentId)]));
}
export async function getService(serviceId: string, client = getReadClient()) {
  return mapService(await read(client, "get_service", [BigInt(serviceId)]));
}
export async function getSubscription(id: string, client = getReadClient()) {
  return mapSubscription(await read(client, "get_subscription", [BigInt(id)]));
}
export async function getDelivery(id: string, client = getReadClient()) {
  return mapDelivery(await read(client, "get_delivery", [BigInt(id)]));
}
export async function getAgents(offset = 0, limit = 50, client = getReadClient()) {
  return page(
    await read(client, "get_agents", [BigInt(offset), BigInt(limit)]),
    "agents",
    mapAgent,
  );
}
export async function getServices(offset = 0, limit = 50, client = getReadClient()) {
  return page(
    await read(client, "get_services", [BigInt(offset), BigInt(limit)]),
    "services",
    mapService,
  );
}
export async function getAvailableServices(offset = 0, limit = 50, client = getReadClient()) {
  return page(
    await read(client, "get_available_services", [BigInt(offset), BigInt(limit)]),
    "services",
    mapService,
  );
}
export async function getSubscriptionsByBuyer(
  id: string,
  offset = 0,
  limit = 50,
  client = getReadClient(),
) {
  return page(
    await read(client, "get_subscriptions_by_buyer", [BigInt(id), BigInt(offset), BigInt(limit)]),
    "subscriptions",
    mapSubscription,
  );
}
export async function getSubscriptionsByProvider(
  id: string,
  offset = 0,
  limit = 50,
  client = getReadClient(),
) {
  return page(
    await read(client, "get_subscriptions_by_provider", [
      BigInt(id),
      BigInt(offset),
      BigInt(limit),
    ]),
    "subscriptions",
    mapSubscription,
  );
}
export async function getDeliveries(offset = 0, limit = 50, client = getReadClient()) {
  return page(
    await read(client, "get_deliveries", [BigInt(offset), BigInt(limit)]),
    "deliveries",
    mapDelivery,
  );
}
export async function getSubscriptionDeliveries(
  id: string,
  offset = 0,
  limit = 50,
  client = getReadClient(),
) {
  return page(
    await read(client, "get_subscription_deliveries", [BigInt(id), BigInt(offset), BigInt(limit)]),
    "deliveries",
    mapDelivery,
  );
}
export async function getProviderDeliveries(
  id: string,
  offset = 0,
  limit = 50,
  client = getReadClient(),
) {
  return page(
    await read(client, "get_provider_deliveries", [BigInt(id), BigInt(offset), BigInt(limit)]),
    "deliveries",
    mapDelivery,
  );
}
export async function getProviderPerformance(id: string, client = getReadClient()) {
  return mapAgent(await read(client, "get_provider_performance", [BigInt(id)]));
}
export async function getBuyerEscrow(id: string, client = getReadClient()) {
  return mapEscrow(await read(client, "get_buyer_escrow", [BigInt(id)]));
}
export async function getTotalActivity(client = getReadClient()) {
  return mapActivity(await read(client, "get_total_activity"));
}

function write(method: string, args: unknown[], value?: bigint): ContractWrite {
  const result: ContractWrite = { kind: "write", address: address(), method, args };
  if (value !== undefined) result.value = value;
  return result;
}
export const registerAgentWrite = (name: string, description: string, operator = "", payout = "") =>
  write("register_agent", [name, description, operator, payout]);
export const updateAgentOperatorWrite = (id: string, operator: string) =>
  write("update_agent_operator", [BigInt(id), operator]);
export const updateAgentPayoutWrite = (id: string, payout: string) =>
  write("update_agent_payout", [BigInt(id), payout]);
export const updateAgentProfileWrite = (id: string, name: string, description: string) =>
  write("update_agent_profile", [BigInt(id), name, description]);
export const setAgentActiveWrite = (id: string, active: boolean) =>
  write("set_agent_active", [BigInt(id), active]);
export const createServiceWrite = (
  id: string,
  name: string,
  description: string,
  category: string,
  scope: string,
  priceWei: bigint,
) => write("create_service", [BigInt(id), name, description, category, scope, priceWei]);
export const updateServiceWrite = (
  id: string,
  name: string,
  description: string,
  category: string,
  scope: string,
  active: boolean,
) => write("update_service", [BigInt(id), name, description, category, scope, active]);
export function subscribeWrite(input: {
  buyerAgentId: string;
  serviceId: string;
  requirements: string;
  allowedTopics: string;
  durationSeconds: bigint;
  maxPaidAlerts: bigint;
  maxTotalSpendWei: bigint;
  maxSubmissions: bigint;
  value: bigint;
}) {
  return write(
    "subscribe",
    [
      BigInt(input.buyerAgentId),
      BigInt(input.serviceId),
      input.requirements,
      input.allowedTopics,
      input.durationSeconds,
      input.maxPaidAlerts,
      input.maxTotalSpendWei,
      input.maxSubmissions,
    ],
    input.value,
  );
}
export const fundSubscriptionWrite = (id: string, value: bigint) =>
  write("fund_subscription", [BigInt(id)], value);
export const cancelSubscriptionWrite = (id: string) => write("cancel_subscription", [BigInt(id)]);
export const expireSubscriptionWrite = (id: string) => write("expire_subscription", [BigInt(id)]);
export const withdrawRefundWrite = (id: string) =>
  write("withdraw_subscription_refund", [BigInt(id)]);
export function submitReportWrite(input: {
  subscriptionId: string;
  reportId: string;
  reportUrl: string;
  reportSha256: string;
  metadata: string;
}) {
  return write("submit_alert", [
    BigInt(input.subscriptionId),
    input.reportId,
    input.reportUrl,
    input.reportSha256,
    input.metadata,
  ]);
}
export const evaluateDeliveryWrite = (id: string) => write("evaluate_delivery", [BigInt(id)]);
export const resolveInconclusiveWrite = (id: string) =>
  write("resolve_inconclusive_delivery", [BigInt(id)]);

export function isControlledBy(agent: Agent, addressValue?: string) {
  if (!addressValue) return false;
  return [agent.owner, agent.operator].some(
    (candidate) => candidate.toLowerCase() === addressValue.toLowerCase(),
  );
}
export { STUDIO_NEXT_CHAIN_ID };
