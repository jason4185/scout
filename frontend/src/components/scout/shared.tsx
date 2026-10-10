import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Radar,
  ShieldCheck,
  Code2,
  Gift,
  Package,
  Menu,
  LayoutDashboard,
  Layers,
  FileCheck2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getAgent, type Agent, type Service } from "@/lib/genlayer/scout";
import { WalletControl } from "@/lib/genlayer/wallet";

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="SCOUT home">
      <Radar className="size-7 text-primary" strokeWidth={1.7} />
      SCOUT<span className="text-primary text-xs self-start mt-1">®</span>
    </Link>
  );
}
export function Header() {
  const [menu, setMenu] = useState(false);
  const links = [
    ["Marketplace", "/marketplace"],
    ["Agents", "/agents"],
    ["How it works", "/how-it-works"],
    ["Dashboard", "/dashboard"],
  ] as const;
  return (
    <>
      <header className="site-header">
        <div className="container-wide header-inner">
          <Brand />
          <nav className="header-nav" aria-label="Main navigation">
            {links.map(([name, to]) => (
              <Link key={to} to={to}>
                {name}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <span className="demo-tag">
              <i className="demo-dot" />
              Studio Next
            </span>
            <WalletControl />
            <Button
              className="mobile-toggle"
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </Button>
          </div>
        </div>
      </header>
      <div className="demo-strip">
        Live contract data · GenLayer Studio Next <span className="mx-2 text-border">/</span> Chain
        61997
      </div>
      <Dialog open={menu} onOpenChange={setMenu}>
        <DialogContent className="demo-dialog">
          <DialogTitle>Explore SCOUT</DialogTitle>
          <DialogDescription>
            Criteria-approved intelligence, settled by GenLayer consensus.
          </DialogDescription>
          <nav className="grid gap-4">
            {links.map(([name, to]) => (
              <Link key={to} to={to} onClick={() => setMenu(false)} className="py-2">
                {name}
              </Link>
            ))}
          </nav>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="container-wide">
        <div className="footer-top">
          <div>
            <Brand />
            <p className="text-xs text-muted-foreground mt-4">
              Better intelligence. Aligned incentives.
            </p>
          </div>
          <div className="footer-links">
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/agents">Agents</Link>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SCOUT · Built for the agent economy</span>
          <span>Live Studio Next preview · Chain 61997</span>
        </div>
      </div>
    </footer>
  );
}
export function CategoryIcon({
  category,
  className = "size-5",
}: {
  category: string;
  className?: string;
}) {
  const Icon = category.toLowerCase().includes("security")
    ? ShieldCheck
    : category.toLowerCase().includes("api")
      ? Code2
      : category.toLowerCase().includes("grant") || category.toLowerCase().includes("opportunity")
        ? Gift
        : Package;
  return <Icon className={className} strokeWidth={1.6} />;
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`pill pill-${value.toLowerCase()}`}>
      <span className="size-1 rounded-full bg-current" />
      {value}
    </span>
  );
}
export function AgentLine({ id, agent: supplied }: { id: string; agent?: Agent | undefined }) {
  const query = useQuery({
    queryKey: ["scout", "agent", id],
    queryFn: () => getAgent(id),
    enabled: !supplied,
    staleTime: 15_000,
  });
  const agent = supplied ?? query.data;
  if (!agent) return <span className="agent-line text-muted-foreground">Agent {id}</span>;
  return (
    <Link to="/agent/$id" params={{ id }} className="agent-line">
      <span className="avatar">{agent.name.slice(0, 2).toUpperCase()}</span>
      <span>
        {agent.name}
        <small>{agent.active ? "Provider agent · Onchain profile" : "Inactive agent"}</small>
      </span>
    </Link>
  );
}
export function ServiceCard({ service }: { service: Service }) {
  const agentQuery = useQuery({
    queryKey: ["scout", "agent", service.providerAgentId],
    queryFn: () => getAgent(service.providerAgentId),
    staleTime: 15_000,
  });
  const agent = agentQuery.data;
  return (
    <article className="service-card">
      <div className="flex justify-between items-start">
        <div className="service-icon">
          <CategoryIcon category={service.category} />
        </div>
        <span className="pill">{service.category}</span>
      </div>
      <AgentLine id={service.providerAgentId} agent={agent} />
      <h3>
        <Link to="/service/$id" params={{ id: service.id }}>
          {service.name}
        </Link>
      </h3>
      <p>{service.description}</p>
      <div className="flex gap-3 text-[10px] text-muted-foreground mt-4">
        <span>
          <ShieldCheck className="inline size-3 text-success mr-1" />
          Criteria evaluated
        </span>
        <span>{service.active ? "Active listing" : "Inactive listing"}</span>
      </div>
      <div className="service-bottom">
        <div>
          <span className="price">
            {service.priceGen} <small>GEN</small>
          </span>
          <p className="!text-[10px] !m-0">per accepted report</p>
        </div>
        <Button asChild size="icon" variant="outline" aria-label={`View ${service.name}`}>
          <Link to="/service/$id" params={{ id: service.id }}>
            <ArrowUpRight />
          </Link>
        </Button>
      </div>
    </article>
  );
}
export function PageHeading({
  label,
  title,
  description,
  action,
}: {
  label?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {label && (
          <span className="eyebrow">
            <i className="demo-dot" />
            {label}
          </span>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="container-wide page app-layout">
      <aside className="sidebar">
        <p className="sidebar-label">WORKSPACE</p>
        {(
          [
            { to: "/dashboard", name: "Overview", icon: LayoutDashboard },
            { to: "/subscriptions", name: "Subscriptions", icon: Layers },
            { to: "/deliveries", name: "Deliveries", icon: FileCheck2 },
            { to: "/create-service", name: "Create service", icon: Plus },
          ] as const
        ).map((item) => (
          <Link key={item.to} to={item.to} activeOptions={{ exact: true }}>
            <item.icon />
            {item.name}
          </Link>
        ))}
        <div className="sidebar-note">
          <span className="demo-tag">
            <i className="demo-dot" />
            Onchain workspace
          </span>
          <p>
            State is read from the deployed SCOUT contract.
            <br />
            Writes require wallet approval.
          </p>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search services...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-box">
      <Search />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => onChange("")}>
          <X />
        </Button>
      )}
    </div>
  );
}
export function Empty({
  children = "No onchain records match your filters.",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Radar className="size-7 mx-auto mb-4 text-primary" />
      {children}
    </div>
  );
}
export function PageControls({
  page,
  hasMore,
  total,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total <= 50 && page === 0) return null;
  return (
    <div className="mt-8 flex items-center justify-center gap-3 text-xs text-muted-foreground">
      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span>
        Page {page + 1} · {total} total
      </span>
      <Button size="sm" variant="outline" disabled={!hasMore} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}
export function Stat({
  label,
  value,
  note = "Live contract data",
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="stat">
      <label>{label}</label>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
export function Missing() {
  return (
    <div className="container-wide page">
      <PageHeading
        title="Not found"
        description="This onchain record does not exist or is no longer available."
      />
      <Button asChild>
        <Link to="/marketplace">
          Explore marketplace
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
