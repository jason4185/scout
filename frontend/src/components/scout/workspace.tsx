import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CheckCheck, FileJson, Plus, Radar, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { isAddress } from "viem";
import { normalizeScoutError } from "@/lib/genlayer/errors";
import { TransactionRunner } from "@/lib/genlayer/transaction";
import { useWallet } from "@/lib/genlayer/wallet";
import {
  createServiceWrite,
  cancelSubscriptionWrite,
  expireSubscriptionWrite,
  evaluateDeliveryWrite,
  getAgents,
  getBuyerEscrow,
  getProviderDeliveries,
  getServices,
  getSubscriptionDeliveries,
  getSubscriptionsByBuyer,
  getSubscriptionsByProvider,
  formatGen,
  parseGenAmount,
  registerAgentWrite,
  resolveInconclusiveWrite,
  setAgentActiveWrite,
  submitReportWrite,
  subscribeWrite,
  fundSubscriptionWrite,
  updateAgentOperatorWrite,
  updateAgentPayoutWrite,
  updateAgentProfileWrite,
  updateServiceWrite,
  withdrawRefundWrite,
  type Delivery,
  type Subscription,
} from "@/lib/genlayer/scout";
import type { Agent, Service } from "@/lib/genlayer/scout";
import { SCOUT_CONTRACT_ADDRESS, GENLAYER_CONFIG_ERROR } from "@/lib/genlayer/network";
import {
  isReportAbort,
  prepareReport,
  type PreparedReport,
  validateReportId,
  validateReportSha256,
  validateReportUrl,
} from "@/lib/genlayer/report";
import { AppShell, Empty, Field, PageControls, PageHeading, SearchBox, Status } from "./shared";

const key = ["scout", SCOUT_CONTRACT_ADDRESS] as const;
const options = { staleTime: 15_000, retry: 1 };
const SCOUT_ACTIVE = !GENLAYER_CONFIG_ERROR;
export type ScoutWorkspaceFocus =
  "all" | "marketplace" | "dashboard" | "subscriptions" | "deliveries" | "agents" | "service";

function ScoutBanner() {
  if (SCOUT_ACTIVE) return <div className="message">SCOUT contract: {SCOUT_CONTRACT_ADDRESS}</div>;
  return (
    <div className="message message-error" role="alert">
      SCOUT is not configured for Studio Next. Check the chain, RPC, and contract address settings.
    </div>
  );
}

function useScoutAgents() {
  return useQuery({
    queryKey: [...key, "agents"],
    queryFn: () => getAgents(0, 50),
    enabled: SCOUT_ACTIVE,
    ...options,
  });
}
function useScoutServices(offset = 0, limit = 50) {
  return useQuery({
    queryKey: [...key, "services", offset, limit],
    queryFn: () => getServices(offset, limit),
    enabled: SCOUT_ACTIVE,
    ...options,
  });
}
function useScoutProviderSubscriptions(agentId?: string) {
  return useQuery({
    queryKey: [...key, "provider-subscriptions", agentId],
    queryFn: () => getSubscriptionsByProvider(agentId ?? "0"),
    enabled: Boolean(SCOUT_ACTIVE && agentId),
    ...options,
  });
}
function useScoutProviderDeliveries(agentId?: string) {
  return useQuery({
    queryKey: [...key, "provider-deliveries", agentId],
    queryFn: () => getProviderDeliveries(agentId ?? "0"),
    enabled: Boolean(SCOUT_ACTIVE && agentId),
    ...options,
  });
}
function useScoutBuyerSubscriptions(agentId?: string) {
  return useQuery({
    queryKey: [...key, "buyer-subscriptions", agentId],
    queryFn: () => getSubscriptionsByBuyer(agentId ?? "0"),
    enabled: Boolean(SCOUT_ACTIVE && agentId),
    ...options,
  });
}
function useScoutBuyerEscrow(agentId?: string) {
  return useQuery({
    queryKey: [...key, "buyer-escrow", agentId],
    queryFn: () => getBuyerEscrow(agentId ?? "0"),
    enabled: Boolean(SCOUT_ACTIVE && agentId),
    ...options,
  });
}
function useScoutSubscriptionDeliveries(subscriptionId?: string) {
  return useQuery({
    queryKey: [...key, "subscription-deliveries", subscriptionId],
    queryFn: () => getSubscriptionDeliveries(subscriptionId ?? "0"),
    enabled: Boolean(SCOUT_ACTIVE && subscriptionId),
    ...options,
  });
}

export function ScoutWorkspace({
  focus = "all",
  initialAgentId,
  initialServiceId,
  initialSubscriptionId,
  initialDeliveryId,
}: {
  focus?: ScoutWorkspaceFocus;
  initialAgentId?: string;
  initialServiceId?: string;
  initialSubscriptionId?: string;
  initialDeliveryId?: string;
}) {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const agents = useScoutAgents();
  const [servicePage, setServicePage] = useState(0);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceCategory, setServiceCategory] = useState("All");
  const services = useScoutServices(servicePage * 50, 50);
  const controlled = useMemo(
    () =>
      (agents.data?.items ?? []).filter(
        (agent) =>
          wallet.address &&
          [agent.owner, agent.operator].some(
            (candidate) => candidate.toLowerCase() === wallet.address?.toLowerCase(),
          ),
      ),
    [agents.data?.items, wallet.address],
  );
  const [agentId, setAgentId] = useState(initialAgentId ?? "");
  const selectedAgent = controlled.find((agent) => agent.id === agentId) ?? controlled[0];
  const subscriptions = useScoutProviderSubscriptions(selectedAgent?.id);
  const deliveries = useScoutProviderDeliveries(selectedAgent?.id);
  const buyerSubscriptions = useScoutBuyerSubscriptions(selectedAgent?.id);
  const buyerEscrow = useScoutBuyerEscrow(selectedAgent?.id);
  const [deliverySubscriptionId, setDeliverySubscriptionId] = useState(initialSubscriptionId ?? "");
  const buyerDeliverySubscription =
    buyerSubscriptions.data?.items.find((item) => item.id === deliverySubscriptionId) ??
    buyerSubscriptions.data?.items[0];
  const buyerDeliveries = useScoutSubscriptionDeliveries(buyerDeliverySubscription?.id);
  const [dialog, setDialog] = useState<
    "agent" | "agent-manage" | "service" | "service-manage" | "subscribe" | "report" | "fund" | null
  >(null);
  const [fundSubscriptionId, setFundSubscriptionId] = useState("");
  const [editServiceId, setEditServiceId] = useState("");
  const [write, setWrite] = useState<import("@/lib/genlayer/scout").ContractWrite>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: key });
  function queueWrite(next: import("@/lib/genlayer/scout").ContractWrite) {
    if (!wallet.kit || !wallet.connectedClient) {
      setError(
        wallet.status === "wrong-network"
          ? "Switch your wallet to GenLayer Studio Next before reviewing a transaction."
          : "Connect an unlocked Studio Next wallet before reviewing a transaction.",
      );
      return;
    }
    setWrite(next);
  }
  function begin(kind: typeof dialog) {
    setError("");
    setNotice("");
    setDialog(kind);
  }
  function handleError(reason: unknown) {
    setError(normalizeScoutError(reason, "The SCOUT action could not be prepared."));
  }
  const showServices = focus === "all" || focus === "marketplace" || focus === "dashboard";
  const showAgents = focus === "all" || focus === "dashboard" || focus === "agents";
  const showProvider = focus === "all" || focus === "dashboard" || focus === "deliveries";
  const showBuyer =
    focus === "all" || focus === "dashboard" || focus === "subscriptions" || focus === "deliveries";
  const serviceItems = services.data?.items ?? [];
  const agentItems = initialAgentId
    ? (agents.data?.items ?? []).filter((agent) => agent.id === initialAgentId)
    : (agents.data?.items ?? []);
  const serviceCategories = [...new Set(serviceItems.map((service) => service.category))].sort();
  const serviceResults = serviceItems.filter(
    (service) =>
      (!initialServiceId || service.id === initialServiceId) &&
      (initialServiceId || service.active || service.providerAgentId === selectedAgent?.id) &&
      (serviceCategory === "All" || service.category === serviceCategory) &&
      `${service.name} ${service.description} ${service.scope}`
        .toLowerCase()
        .includes(serviceSearch.toLowerCase()),
  );
  return (
    <AppShell>
      <PageHeading
        label="SCOUT · CRITERIA-APPROVED INTELLIGENCE"
        title="One report. Clear requirements."
        description="Buyers freeze acceptance criteria, providers submit one bounded JSON report, and GenLayer evaluates whether the requirements are satisfied. Approval is not a guarantee that every factual claim is true."
        action={
          <span className="demo-tag">
            <i className="demo-dot" /> Live contract workspace
          </span>
        }
      />
      <ScoutBanner />
      {!wallet.address ? (
        <div className="panel mt-6">
          <Wallet className="size-8 text-primary mb-5" />
          <h2>Connect a Studio Next wallet</h2>
          <p>Reads are public; writes require an authorized wallet.</p>
          <Button className="mt-5" onClick={() => void wallet.connect()}>
            Connect wallet
          </Button>
        </div>
      ) : (
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Controlled agent
            <select
              className="select-control !w-auto"
              value={selectedAgent?.id ?? ""}
              onChange={(event) => setAgentId(event.target.value)}
            >
              {controlled.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.id} · {agent.name}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" onClick={() => begin("agent")}>
            <Plus /> Register agent
          </Button>
          <Button variant="outline" disabled={!selectedAgent} onClick={() => begin("agent-manage")}>
            Manage agent
          </Button>
          <Button variant="outline" disabled={!selectedAgent} onClick={() => begin("service")}>
            <Plus /> Create service
          </Button>
          <Button variant="ghost" onClick={invalidate}>
            <RefreshCw /> Refresh
          </Button>
        </div>
      )}
      {error && (
        <div className="message message-error mt-5" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="message mt-5" role="status">
          {notice}
        </div>
      )}
      {showAgents && (
        <section className="mt-10">
          <div className="section-topline">
            <h2>Agent directory</h2>
            <span className="text-xs text-muted-foreground">
              Wallet-controlled onchain profiles
            </span>
          </div>
          {agents.isLoading ? (
            <Empty>Loading agents…</Empty>
          ) : agents.error ? (
            <div className="message message-error">
              {normalizeScoutError(agents.error)}{" "}
              <Button size="sm" variant="outline" onClick={() => void agents.refetch()}>
                Retry
              </Button>
            </div>
          ) : agents.data?.items.length ? (
            <div className="service-grid">
              {agentItems.map((agent) => (
                <article className="service-card" key={agent.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="service-icon">
                      <Wallet className="size-5 text-primary" />
                    </div>
                    <Status value={agent.active ? "ACTIVE" : "INACTIVE"} />
                  </div>
                  <p className="agent-line text-muted-foreground">
                    Agent {agent.id}
                    <small>{agent.owner}</small>
                  </p>
                  <h3>
                    <Link to="/agent/$id" params={{ id: agent.id }}>
                      {agent.name}
                    </Link>
                  </h3>
                  <p>{agent.description}</p>
                  <div className="service-bottom">
                    <span className="text-xs text-muted-foreground">
                      {agent.approvedAlerts} accepted reports ·{" "}
                      {formatGen(agent.verifiedEarningsWei)} GEN
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty>No agents are registered yet.</Empty>
          )}
        </section>
      )}
      {showServices && (
        <section className="mt-10">
          <div className="section-topline">
            <h2>Available services</h2>
            <span className="text-xs text-muted-foreground">
              One URL · raw SHA-256 · criteria evaluation
            </span>
          </div>
          <div className="filters mt-5">
            <SearchBox
              value={serviceSearch}
              onChange={setServiceSearch}
              placeholder="Search services…"
            />
            <div className="flex gap-2 flex-wrap">
              {["All", ...serviceCategories].map((category) => (
                <Button
                  key={category}
                  size="sm"
                  variant={serviceCategory === category ? "secondary" : "ghost"}
                  onClick={() => setServiceCategory(category)}
                  aria-pressed={serviceCategory === category}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
          {services.isLoading ? (
            <Empty>Loading services…</Empty>
          ) : services.error ? (
            <div className="message message-error">
              {normalizeScoutError(services.error)}{" "}
              <Button size="sm" variant="outline" onClick={() => void services.refetch()}>
                Retry
              </Button>
            </div>
          ) : serviceResults.length ? (
            <div className="service-grid">
              {serviceResults.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onSubscribe={() => begin("subscribe")}
                  canManage={service.providerAgentId === selectedAgent?.id}
                  onManage={() => {
                    setEditServiceId(service.id);
                    begin("service-manage");
                  }}
                />
              ))}
            </div>
          ) : (
            <Empty>No services are listed yet.</Empty>
          )}
          {services.data && (
            <PageControls
              page={servicePage}
              hasMore={services.data.hasMore}
              total={services.data.total}
              onPage={setServicePage}
            />
          )}
        </section>
      )}
      {showProvider && (
        <section className="mt-12">
          <div className="section-topline">
            <h2>Provider delivery queue</h2>
            <span className="text-xs text-muted-foreground">
              Queued payments remain distinct from transfer confirmation
            </span>
          </div>
          {deliveries.data?.items.filter(
            (item) => !initialDeliveryId || item.id === initialDeliveryId,
          ).length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>REPORT</th>
                    <th>STATE</th>
                    <th>PRICE</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.data.items
                    .filter((item) => !initialDeliveryId || item.id === initialDeliveryId)
                    .map((delivery) => (
                      <DeliveryRow
                        key={delivery.id}
                        delivery={delivery}
                        onEvaluate={() => {
                          setAgentId(selectedAgent?.id ?? "");
                          queueWrite(evaluateDeliveryWrite(delivery.id));
                        }}
                        onResolve={() => queueWrite(resolveInconclusiveWrite(delivery.id))}
                      />
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              {selectedAgent
                ? "No provider deliveries for this agent."
                : "Select a controlled provider agent."}
            </Empty>
          )}
        </section>
      )}
      {showBuyer && (
        <section className="mt-12">
          <div className="section-topline">
            <h2>Buyer subscriptions & escrow</h2>
            <span className="text-xs text-muted-foreground">
              Available GEN can be refunded only after cancellation or expiry
            </span>
          </div>
          {buyerEscrow.data && (
            <div className="stats-grid mt-5">
              <div className="stat-card">
                <span>Available escrow</span>
                <strong>{formatGen(buyerEscrow.data.availableEscrowWei)} GEN</strong>
              </div>
              <div className="stat-card">
                <span>Reserved escrow</span>
                <strong>{formatGen(buyerEscrow.data.reservedEscrowWei)} GEN</strong>
              </div>
            </div>
          )}
          {buyerSubscriptions.isLoading ? (
            <Empty>Loading buyer subscriptions…</Empty>
          ) : buyerSubscriptions.error ? (
            <div className="message message-error">
              {normalizeScoutError(buyerSubscriptions.error)}{" "}
              <Button size="sm" variant="outline" onClick={() => void buyerSubscriptions.refetch()}>
                Retry
              </Button>
            </div>
          ) : buyerSubscriptions.data?.items.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SUBSCRIPTION</th>
                    <th>ESCROW</th>
                    <th>CAPACITY</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {buyerSubscriptions.data.items.map((subscription) => (
                    <BuyerSubscriptionRow
                      key={subscription.id}
                      subscription={subscription}
                      onFund={() => {
                        setFundSubscriptionId(subscription.id);
                        setDialog("fund");
                      }}
                      onCancel={() => queueWrite(cancelSubscriptionWrite(subscription.id))}
                      onExpire={() => queueWrite(expireSubscriptionWrite(subscription.id))}
                      onRefund={() => queueWrite(withdrawRefundWrite(subscription.id))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>
              {selectedAgent
                ? "No buyer subscriptions for this agent."
                : "Select a controlled agent."}
            </Empty>
          )}
          {buyerDeliverySubscription && (
            <div className="mt-8">
              <div className="section-topline">
                <h3>Buyer delivery history</h3>
                <select
                  className="select-control !w-auto"
                  value={buyerDeliverySubscription.id}
                  onChange={(event) => setDeliverySubscriptionId(event.target.value)}
                  aria-label="Subscription delivery history"
                >
                  {(buyerSubscriptions.data?.items ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id} · {item.serviceName}
                    </option>
                  ))}
                </select>
              </div>
              {buyerDeliveries.data?.items.length ? (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>REPORT</th>
                        <th>STATE</th>
                        <th>PRICE</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buyerDeliveries.data.items.map((delivery) => (
                        <DeliveryRow
                          key={delivery.id}
                          delivery={delivery}
                          onEvaluate={() => queueWrite(evaluateDeliveryWrite(delivery.id))}
                          onResolve={() => queueWrite(resolveInconclusiveWrite(delivery.id))}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No reports have been submitted for this subscription.</Empty>
              )}
            </div>
          )}
        </section>
      )}
      {dialog === "agent" && (
        <AgentDialog onClose={() => setDialog(null)} onWrite={queueWrite} onError={handleError} />
      )}
      {dialog === "service" && selectedAgent && (
        <ServiceDialog
          agentId={selectedAgent.id}
          onClose={() => setDialog(null)}
          onWrite={queueWrite}
          onError={handleError}
        />
      )}
      {dialog === "agent-manage" && selectedAgent && (
        <AgentManagementDialog
          agent={selectedAgent}
          onClose={() => setDialog(null)}
          onWrite={queueWrite}
          onError={handleError}
        />
      )}
      {dialog === "service-manage" && editServiceId && (
        <ServiceManagementDialog
          service={serviceItems.find((item) => item.id === editServiceId)}
          onClose={() => setDialog(null)}
          onWrite={queueWrite}
          onError={handleError}
        />
      )}
      {dialog === "subscribe" && (
        <SubscribeDialog
          services={serviceItems.filter((item) => item.active)}
          agents={controlled}
          onClose={() => setDialog(null)}
          onWrite={queueWrite}
          onError={handleError}
        />
      )}
      {dialog === "report" && selectedAgent && (
        <ReportDialog
          subscriptions={subscriptions.data?.items ?? []}
          onClose={() => setDialog(null)}
          onWrite={queueWrite}
          onError={handleError}
        />
      )}
      {dialog === "fund" && (
        <FundDialog
          subscriptions={buyerSubscriptions.data?.items ?? []}
          initialId={fundSubscriptionId}
          onClose={() => setDialog(null)}
          onWrite={queueWrite}
          onError={handleError}
        />
      )}
      {write && wallet.kit && wallet.connectedClient && (
        <TransactionRunner
          account={wallet.address}
          kit={wallet.kit}
          client={wallet.connectedClient}
          write={write}
          onDismiss={() => setWrite(undefined)}
          onError={(reason) => {
            setWrite(undefined);
            handleError(reason);
          }}
          onSuccess={async () => {
            setWrite(undefined);
            setDialog(null);
            setNotice(
              "Transaction execution succeeded. Refreshing live state; queued transfers still require independent confirmation.",
            );
            invalidate();
          }}
          intro={
            <div>
              <strong>Review SCOUT transaction</strong>
              <p className="mt-2 text-sm text-white/70">
                The contract evaluates one report against frozen buyer requirements. Network fees
                are separate from protocol GEN.
              </p>
            </div>
          }
        />
      )}
      {selectedAgent && showProvider && (
        <Button className="mt-6" onClick={() => begin("report")}>
          <FileJson /> Submit one JSON report
        </Button>
      )}
    </AppShell>
  );
}

function DeliveryRow({
  delivery,
  onEvaluate,
  onResolve,
}: {
  delivery: Delivery;
  onEvaluate: () => void;
  onResolve: () => void;
}) {
  return (
    <tr>
      <td>
        <strong>{delivery.reportId}</strong>
        <small className="block text-muted-foreground break-all">{delivery.reportUrl}</small>
      </td>
      <td>
        <Status value={delivery.decision} />
      </td>
      <td>{delivery.priceGen} GEN</td>
      <td>
        {delivery.decision === "PENDING" || delivery.decision === "INCONCLUSIVE" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEvaluate}>
              Evaluate
            </Button>
            {delivery.decision === "INCONCLUSIVE" && (
              <Button size="sm" variant="outline" onClick={onResolve}>
                Resolve / recover
              </Button>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {delivery.payoutStatus === "QUEUED" ? "Transfer queued" : "Settled"}
          </span>
        )}
      </td>
    </tr>
  );
}

function ServiceCard({
  service,
  onSubscribe,
  canManage,
  onManage,
}: {
  service: Awaited<ReturnType<typeof getServices>>["items"][number];
  onSubscribe: () => void;
  canManage: boolean;
  onManage: () => void;
}) {
  return (
    <article className="service-card">
      <div className="flex justify-between items-start">
        <div className="service-icon">
          <Radar className="size-5 text-primary" />
        </div>
        <span className="pill">{service.category}</span>
      </div>
      <p className="agent-line text-muted-foreground">
        Provider agent {service.providerAgentId}
        <small>Onchain listing</small>
      </p>
      <h3>
        <Link to="/service/$id" params={{ id: service.id }}>
          {service.name}
        </Link>
      </h3>
      <p>{service.description}</p>
      <p className="mt-3 text-xs text-muted-foreground">{service.scope}</p>
      <div className="service-bottom">
        <div>
          <span className="price">
            {service.priceGen} <small>GEN</small>
          </span>
          <p className="!text-[10px] !m-0">per accepted report</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button size="sm" variant="ghost" onClick={onManage}>
              Manage
            </Button>
          )}
          <Button
            size="icon"
            variant="outline"
            onClick={onSubscribe}
            disabled={!service.active}
            aria-label={`Subscribe to ${service.name}`}
          >
            <ArrowUpRight />
          </Button>
        </div>
      </div>
    </article>
  );
}

function BuyerSubscriptionRow({
  subscription,
  onFund,
  onCancel,
  onExpire,
  onRefund,
}: {
  subscription: Subscription;
  onFund: () => void;
  onCancel: () => void;
  onExpire: () => void;
  onRefund: () => void;
}) {
  const expired = Math.floor(Date.now() / 1000) > subscription.expiresAt;
  const refundable = subscription.availableEscrowWei > 0n;
  return (
    <tr>
      <td>
        <strong>
          #{subscription.id} · {subscription.serviceName}
        </strong>
        <small className="block text-muted-foreground">
          {subscription.state} · {formatGen(subscription.agreedPriceWei)} GEN/accepted report
        </small>
      </td>
      <td>
        <span className="block">{formatGen(subscription.availableEscrowWei)} available</span>
        <small className="text-muted-foreground">
          {formatGen(subscription.reservedEscrowWei)} reserved
        </small>
      </td>
      <td>
        {subscription.paidAlerts}/{subscription.maxPaidAlerts} paid · {subscription.submittedAlerts}
        /{subscription.maxSubmissions} submitted
      </td>
      <td>
        <div className="flex flex-wrap gap-2">
          {subscription.state === "ACTIVE" && (
            <>
              <Button size="sm" variant="outline" onClick={onFund}>
                Fund
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" variant="outline" disabled={!expired} onClick={onExpire}>
                Expire
              </Button>
            </>
          )}
          {subscription.state !== "ACTIVE" && (
            <Button size="sm" variant="outline" disabled={!refundable} onClick={onRefund}>
              Withdraw available refund
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function AgentDialog({
  onClose,
  onWrite,
  onError,
}: {
  onClose: () => void;
  onWrite: (write: import("@/lib/genlayer/scout").ContractWrite) => void;
  onError: (reason: unknown) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="demo-dialog">
        <DialogTitle>Register agent</DialogTitle>
        <DialogDescription>
          Creates a wallet-controlled agent on the deployed SCOUT contract.
        </DialogDescription>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              if (!name.trim() || !description.trim())
                throw new Error("Name and description are required.");
              onWrite(registerAgentWrite(name.trim(), description.trim()));
            } catch (reason) {
              onError(reason);
            }
          }}
        >
          <Field label="Agent name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
          </Field>
          <Field label="Profile description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              required
            />
          </Field>
          <Button type="submit">
            <CheckCheck /> Review registration
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AgentManagementDialog({
  agent,
  onClose,
  onWrite,
  onError,
}: {
  agent: Agent;
  onClose: () => void;
  onWrite: (write: import("@/lib/genlayer/scout").ContractWrite) => void;
  onError: (reason: unknown) => void;
}) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [operator, setOperator] = useState(agent.operator);
  const [payout, setPayout] = useState(agent.payoutAddress);
  function submitProfile(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (!name.trim() || !description.trim())
        throw new Error("Name and description are required.");
      onWrite(updateAgentProfileWrite(agent.id, name.trim(), description.trim()));
    } catch (reason) {
      onError(reason);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="demo-dialog !max-w-2xl">
        <DialogTitle>Manage agent · {agent.id}</DialogTitle>
        <DialogDescription>
          Profile changes require the owner or operator. Operator and payout changes require the
          owner; the contract remains the source of truth.
        </DialogDescription>
        <form className="form-stack" onSubmit={submitProfile}>
          <Field label="Agent name">
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          </Field>
          <Field label="Profile description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
            />
          </Field>
          <Button type="submit">Review profile update</Button>
        </form>
        <div className="form-stack mt-5">
          <Field label="Operator address (blank resets to owner)">
            <input value={operator} onChange={(event) => setOperator(event.target.value)} />
          </Field>
          <Button
            variant="outline"
            onClick={() => {
              try {
                if (operator && !isAddress(operator))
                  throw new Error("Operator address is invalid.");
                onWrite(updateAgentOperatorWrite(agent.id, operator));
              } catch (reason) {
                onError(reason);
              }
            }}
          >
            Review operator update
          </Button>
          <Field label="Payout address">
            <input value={payout} onChange={(event) => setPayout(event.target.value)} />
          </Field>
          <Button
            variant="outline"
            onClick={() => {
              try {
                if (!isAddress(payout)) throw new Error("Payout address is invalid.");
                onWrite(updateAgentPayoutWrite(agent.id, payout));
              } catch (reason) {
                onError(reason);
              }
            }}
          >
            Review payout update
          </Button>
          <Button
            variant="outline"
            onClick={() => onWrite(setAgentActiveWrite(agent.id, !agent.active))}
          >
            Set agent {agent.active ? "inactive" : "active"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ServiceDialog({
  agentId,
  onClose,
  onWrite,
  onError,
}: {
  agentId: string;
  onClose: () => void;
  onWrite: (write: import("@/lib/genlayer/scout").ContractWrite) => void;
  onError: (reason: unknown) => void;
}) {
  const [values, setValues] = useState({
    name: "",
    description: "",
    category: "security",
    scope: "",
    price: "1",
  });
  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="demo-dialog">
        <DialogTitle>Create intelligence service</DialogTitle>
        <DialogDescription>
          Existing subscriptions preserve their frozen service scope and price.
        </DialogDescription>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const price = parseGenAmount(values.price);
              if (
                !values.name.trim() ||
                !values.description.trim() ||
                !values.scope.trim() ||
                price <= 0n
              )
                throw new Error("Complete the service fields and enter a positive GEN price.");
              onWrite(
                createServiceWrite(
                  agentId,
                  values.name.trim(),
                  values.description.trim(),
                  values.category.trim(),
                  values.scope.trim(),
                  price,
                ),
              );
            } catch (reason) {
              onError(reason);
            }
          }}
        >
          <Field label="Service name">
            <input
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              maxLength={120}
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
              maxLength={1200}
              required
            />
          </Field>
          <Field label="Category">
            <input
              value={values.category}
              onChange={(event) => set("category", event.target.value)}
              maxLength={80}
              required
            />
          </Field>
          <Field label="Scope">
            <textarea
              value={values.scope}
              onChange={(event) => set("scope", event.target.value)}
              maxLength={1800}
              required
            />
          </Field>
          <Field label="GEN per accepted report">
            <input
              inputMode="decimal"
              value={values.price}
              onChange={(event) => set("price", event.target.value)}
              required
            />
          </Field>
          <Button type="submit">
            <CheckCheck /> Review service
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceManagementDialog({
  service,
  onClose,
  onWrite,
  onError,
}: {
  service: Service | undefined;
  onClose: () => void;
  onWrite: (write: import("@/lib/genlayer/scout").ContractWrite) => void;
  onError: (reason: unknown) => void;
}) {
  const [values, setValues] = useState(() => ({
    name: service?.name ?? "",
    description: service?.description ?? "",
    category: service?.category ?? "",
    scope: service?.scope ?? "",
    active: service?.active ?? false,
  }));
  if (!service) return null;
  const set = (key: keyof typeof values, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="demo-dialog !max-w-2xl">
        <DialogTitle>Manage service · {service.id}</DialogTitle>
        <DialogDescription>
          Existing subscriptions retain their frozen name, scope, category, and price terms.
        </DialogDescription>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              if (
                !values.name.trim() ||
                !values.description.trim() ||
                !values.category.trim() ||
                !values.scope.trim()
              )
                throw new Error("Complete every service field before reviewing the update.");
              onWrite(
                updateServiceWrite(
                  service.id,
                  values.name.trim(),
                  values.description.trim(),
                  values.category.trim(),
                  values.scope.trim(),
                  values.active,
                ),
              );
            } catch (reason) {
              onError(reason);
            }
          }}
        >
          <Field label="Service name">
            <input
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              maxLength={120}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
              maxLength={1200}
            />
          </Field>
          <Field label="Category">
            <input
              value={values.category}
              onChange={(event) => set("category", event.target.value)}
              maxLength={80}
            />
          </Field>
          <Field label="Scope">
            <textarea
              value={values.scope}
              onChange={(event) => set("scope", event.target.value)}
              maxLength={1800}
            />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={values.active}
              onChange={(event) => set("active", event.target.checked)}
            />
            Listing active
          </label>
          <Button type="submit">Review service update</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FundDialog({
  subscriptions,
  initialId,
  onClose,
  onWrite,
  onError,
}: {
  subscriptions: Subscription[];
  initialId: string;
  onClose: () => void;
  onWrite: (write: import("@/lib/genlayer/scout").ContractWrite) => void;
  onError: (reason: unknown) => void;
}) {
  const [subscriptionId, setSubscriptionId] = useState(initialId || subscriptions[0]?.id || "");
  const [amount, setAmount] = useState("");
  const subscription = subscriptions.find((item) => item.id === subscriptionId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="demo-dialog">
        <DialogTitle>Fund subscription</DialogTitle>
        <DialogDescription>
          Funding increases available escrow up to the subscription's frozen spending cap. GEN
          network fees are estimated separately.
        </DialogDescription>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const value = parseGenAmount(amount);
              if (!subscription || subscription.state !== "ACTIVE" || value <= 0n)
                throw new Error("Choose an active subscription and enter a positive GEN amount.");
              if (subscription.totalFundedWei + value > subscription.maxTotalSpendWei)
                throw new Error("This funding amount exceeds the subscription's maximum spend.");
              onWrite(fundSubscriptionWrite(subscription.id, value));
            } catch (reason) {
              onError(reason);
            }
          }}
        >
          <Field label="Subscription">
            <select
              value={subscriptionId}
              onChange={(event) => setSubscriptionId(event.target.value)}
            >
              {subscriptions
                .filter((item) => item.state === "ACTIVE")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.id} · {item.serviceName}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Additional GEN">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.5"
              required
            />
          </Field>
          {subscription && (
            <p className="text-xs text-muted-foreground">
              Current funded: {formatGen(subscription.totalFundedWei)} GEN · maximum:{" "}
              {formatGen(subscription.maxTotalSpendWei)} GEN
            </p>
          )}
          <Button type="submit">
            <Wallet /> Review funding
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubscribeDialog({
  services,
  agents,
  onClose,
  onWrite,
  onError,
}: {
  services: Awaited<ReturnType<typeof getServices>>["items"];
  agents: Awaited<ReturnType<typeof getAgents>>["items"];
  onClose: () => void;
  onWrite: (write: import("@/lib/genlayer/scout").ContractWrite) => void;
  onError: (reason: unknown) => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [buyerAgentId, setBuyerAgentId] = useState(agents[0]?.id ?? "");
  const [values, setValues] = useState({
    requirements: "",
    topics: "",
    days: "30",
    maxPaid: "2",
    maxSpend: "2",
    submissions: "4",
    escrow: "2",
  });
  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const service = services.find((item) => item.id === serviceId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="demo-dialog !max-w-2xl">
        <DialogTitle>Subscribe to criteria-approved intelligence</DialogTitle>
        <DialogDescription>
          No trusted hosts or second source are required. Define the acceptance criteria that
          GenLayer will judge.
        </DialogDescription>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              if (!service || !buyerAgentId || !values.requirements.trim() || !values.topics.trim())
                throw new Error("Choose a service and complete requirements and topics.");
              const maxSpend = parseGenAmount(values.maxSpend);
              const escrow = parseGenAmount(values.escrow);
              const days = BigInt(values.days);
              const paid = BigInt(values.maxPaid);
              const submissions = BigInt(values.submissions);
              if (
                days < 1n ||
                days > 365n ||
                paid < 1n ||
                paid > 100n ||
                submissions < 1n ||
                submissions > 200n ||
                maxSpend < service.priceWei ||
                escrow < service.priceWei ||
                escrow > maxSpend
              )
                throw new Error("Check duration, caps, and escrow against the service price.");
              onWrite(
                subscribeWrite({
                  buyerAgentId,
                  serviceId,
                  requirements: values.requirements.trim(),
                  allowedTopics: values.topics.trim(),
                  durationSeconds: days * 86400n,
                  maxPaidAlerts: paid,
                  maxTotalSpendWei: maxSpend,
                  maxSubmissions: submissions,
                  value: escrow,
                }),
              );
            } catch (reason) {
              onError(reason);
            }
          }}
        >
          <Field label="Service">
            <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
              {services.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.priceGen} GEN/report
                </option>
              ))}
            </select>
          </Field>
          <Field label="Buyer agent">
            <select value={buyerAgentId} onChange={(event) => setBuyerAgentId(event.target.value)}>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.id} · {agent.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Acceptance requirements">
            <textarea
              value={values.requirements}
              onChange={(event) => set("requirements", event.target.value)}
              maxLength={3000}
              required
              placeholder="Describe the concrete details every accepted report must include."
            />
          </Field>
          <Field label="Allowed topics or subjects">
            <input
              value={values.topics}
              onChange={(event) => set("topics", event.target.value)}
              maxLength={1600}
              required
            />
          </Field>
          <div className="form-grid">
            {(
              [
                ["days", "Duration (days)"],
                ["maxPaid", "Max paid reports"],
                ["maxSpend", "Max total spend (GEN)"],
                ["submissions", "Max submissions"],
                ["escrow", "Initial escrow (GEN)"],
              ] as const
            ).map(([field, label]) => (
              <Field key={field} label={label}>
                <input
                  inputMode={field === "maxSpend" || field === "escrow" ? "decimal" : "numeric"}
                  value={values[field]}
                  onChange={(event) => set(field, event.target.value)}
                />
              </Field>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Protocol escrow is sent as the payable GEN value. Transaction Kit network fees are
            estimated separately.
          </p>
          <Button type="submit">
            <CheckCheck /> Review subscription
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({
  subscriptions,
  onClose,
  onWrite,
  onError,
}: {
  subscriptions: Subscription[];
  onClose: () => void;
  onWrite: (write: import("@/lib/genlayer/scout").ContractWrite) => void;
  onError: (reason: unknown) => void;
}) {
  const [subscriptionId, setSubscriptionId] = useState(
    subscriptions.find((item) => item.state === "ACTIVE")?.id ?? "",
  );
  const [url, setUrl] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [prepared, setPrepared] = useState<PreparedReport | null>(null);
  const [preparation, setPreparation] = useState<{
    status: "idle" | "waiting" | "loading" | "ready" | "error";
    message?: string;
  }>({ status: "idle" });

  useEffect(() => {
    const nextUrl = url;
    setPrepared(null);
    if (!nextUrl) {
      setPreparation({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setPreparation({ status: "waiting" });
    const timer = window.setTimeout(() => {
      setPreparation({ status: "loading" });
      void prepareReport(nextUrl, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setPrepared(result);
          setPreparation({ status: "ready" });
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || isReportAbort(reason)) return;
          setPrepared(null);
          setPreparation({
            status: "error",
            message: reason instanceof Error ? reason.message : "The report could not be prepared.",
          });
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [retryToken, url]);

  const activeSubscription = subscriptions.find((item) => item.id === subscriptionId);
  const canReview = preparation.status === "ready" && Boolean(activeSubscription && prepared);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="demo-dialog !max-w-2xl">
        <DialogTitle>Submit one Netlify JSON report</DialogTitle>
        <DialogDescription>
          Paste one public HTTPS JSON report URL. SCOUT fetches the exact response bytes in your
          browser, validates the report, extracts its event ID, and calculates the SHA-256 before
          opening the transaction review.
        </DialogDescription>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              if (!activeSubscription) throw new Error("Choose an active provider subscription.");
              if (!prepared || !canReview)
                throw new Error(
                  "Wait for the report to be fetched, hashed, and validated before reviewing it.",
                );
              onWrite(
                submitReportWrite({
                  subscriptionId,
                  reportId: validateReportId(prepared.report.event_id),
                  reportUrl: validateReportUrl(prepared.url),
                  reportSha256: validateReportSha256(prepared.sha256),
                  metadata: "{}",
                }),
              );
            } catch (reason) {
              onError(reason);
            }
          }}
        >
          <Field label="Provider subscription">
            <select
              value={subscriptionId}
              onChange={(event) => setSubscriptionId(event.target.value)}
            >
              {subscriptions
                .filter((item) => item.state === "ACTIVE")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} · {item.serviceName}
                  </option>
                ))}
            </select>
          </Field>
          <Field
            label="HTTPS report URL"
            hint="Paste the public URL of the exact JSON file. Automatic retrieval starts after a short pause."
          >
            <input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setPrepared(null);
                setPreparation({ status: event.target.value ? "waiting" : "idle" });
              }}
              inputMode="url"
              autoComplete="url"
              aria-describedby="report-fetch-status"
              required
            />
          </Field>
          <div id="report-fetch-status" aria-live="polite">
            {preparation.status === "waiting" && (
              <p className="message">Ready to fetch this report…</p>
            )}
            {preparation.status === "loading" && (
              <p className="message">
                Fetching exact bytes, calculating SHA-256, and validating JSON…
              </p>
            )}
            {preparation.status === "error" && (
              <div className="message message-error" role="alert">
                <strong>Report preparation failed</strong>
                <p className="mt-2">{preparation.message}</p>
                <p className="mt-2 text-xs">
                  If this is a Netlify CORS error, add an <code>_headers</code> rule for
                  <code>/*</code> with <code>Access-Control-Allow-Origin: *</code>, then retry by
                  changing the URL or using the retry button.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setRetryToken((current) => current + 1)}
                >
                  Retry fetch
                </Button>
              </div>
            )}
          </div>
          {prepared && preparation.status === "ready" && (
            <div className="message" aria-label="Prepared report preview">
              <strong>Report ready for review</strong>
              <div className="mt-3 grid gap-2 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Report ID</span>
                  <code className="break-all text-right">{prepared.report.event_id}</code>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Title</span>
                  <span className="text-right">{prepared.report.title}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Subject</span>
                  <span className="text-right">{prepared.report.subject}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    SHA-256 · {prepared.size.toLocaleString()} bytes
                  </span>
                  <code className="break-all text-right">{prepared.sha256}</code>
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Supporting metadata is sent automatically as <code>{"{}"}</code>. The browser preview is
            a convenience; GenLayer performs the authoritative validator-side retrieval again.
          </p>
          <Button type="submit" disabled={!canReview}>
            <Radar /> Review report submission
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
