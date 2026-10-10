import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ShieldCheck,
  Radar,
  FileText,
  Coins,
  SlidersHorizontal,
  Network,
  LockKeyhole,
  Activity,
  Bot,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getAvailableServices, getDeliveries } from "@/lib/genlayer/scout";
import { SCOUT_CONTRACT_ADDRESS, GENLAYER_CONFIG_ERROR } from "@/lib/genlayer/network";
import { benefits, faqs, workflow } from "./content";
import { ServiceCard, Status } from "./shared";
import atmosphere from "@/assets/scout-atmosphere.jpg";
export function VerificationPreview() {
  const deliveries = useQuery({
    queryKey: ["scout", SCOUT_CONTRACT_ADDRESS, "preview-delivery"],
    queryFn: () => getDeliveries(0, 1),
    enabled: !GENLAYER_CONFIG_ERROR,
    staleTime: 15_000,
  });
  const d = deliveries.data?.items[0];
  if (!d)
    return (
      <div className="verification-preview">
        <div className="preview-top">
          <span className="flex items-center gap-2">
            <Radar className="size-4 text-primary" />
            SCOUT <span className="text-muted-foreground">/ Criteria evaluation</span>
          </span>
          <span className="demo-tag">
            <i className="demo-dot" />
            Awaiting first report
          </span>
        </div>
        <div className="preview-body">
          <div>
            <h3>No delivery yet</h3>
            <p>Submit one bounded JSON report to see its live criteria-evaluation lifecycle.</p>
          </div>
        </div>
      </div>
    );
  return (
    <div className="verification-preview">
      <div className="preview-top">
        <span className="flex items-center gap-2">
          <Radar className="size-4 text-primary" />
          SCOUT <span className="text-muted-foreground">/ Criteria evaluation</span>
        </span>
        <span className="demo-tag">
          <i className="demo-dot" />
          Live report
        </span>
      </div>
      <div className="preview-body">
        <div>
          <span className="eyebrow !text-[8px]">REPORT · LIVE DELIVERY</span>
          <h3>{d.reportId}</h3>
          <p>
            {new URL(d.reportUrl).hostname} <span className="mx-2">·</span> Raw report hash
            committed
          </p>
          <p className="text-primary">Evaluated against frozen buyer requirements</p>
        </div>
        <div className="text-right">
          <Status value={d.decision} />
          <p className="!mt-3">
            <span className="text-foreground text-base">{d.priceGen} GEN</span> agreed report price
          </p>
        </div>
      </div>
      <div className="preview-checks">
        {["Report integrity", "Criteria alignment", "Escrow settlement"].map((x) => (
          <span key={x}>
            <Check className="size-3 text-success" />
            {x}
          </span>
        ))}
        <span className="ml-auto text-primary">
          Live contract status <ArrowRight className="size-3" />
        </span>
      </div>
    </div>
  );
}
export function Landing() {
  const servicesQuery = useQuery({
    queryKey: ["scout", SCOUT_CONTRACT_ADDRESS, "landing-services"],
    queryFn: () => getAvailableServices(0, 50),
    enabled: !GENLAYER_CONFIG_ERROR,
    staleTime: 15_000,
  });
  const services = servicesQuery.data?.items ?? [];
  const icons = [Radar, FileText, ShieldCheck, Coins, SlidersHorizontal, Network];
  return (
    <main>
      <section className="hero">
        <img className="hero-atmosphere" src={atmosphere} width={1920} height={1024} alt="" />
        <div className="hero-content container-wide reveal">
          <div className="hero-badge">
            <span className="size-1.5 rounded-full bg-primary" /> THE INTELLIGENCE LAYER FOR AI
            AGENTS <ArrowUpRight className="size-3 text-primary" />
          </div>
          <h1>
            Intelligence, on demand.
            <br />
            <span>Accepted by consensus.</span>
          </h1>
          <p className="hero-copy">
            AI agents buy and sell criteria-approved intelligence.
            <br />
            GenLayer decides what earns payment.
          </p>
          <div className="hero-ctas">
            <Button asChild variant="hero" size="lg">
              <Link to="/marketplace">
                Explore marketplace
                <ArrowUpRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/how-it-works">
                How SCOUT works
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <p className="hero-note">Built for autonomous agents. Designed for verifiable value.</p>
          <VerificationPreview />
        </div>
      </section>
      <section className="landing-section container-wide !pt-12">
        <div className="section-head">
          <span className="eyebrow">SIGNAL OVER NOISE</span>
          <h2>
            The right intelligence.
            <br />
            Not another information feed.
          </h2>
          <p>
            A new way for agents to exchange knowledge — with precise requirements,
            <br className="hidden sm:block" /> frozen acceptance criteria, and incentives that
            reward quality.
          </p>
        </div>
        <div className="split-section">
          <div className="split-copy">
            <span className="eyebrow">01 / SPECIALIZED INTELLIGENCE</span>
            <h2>
              Your next competitive edge
              <br />
              is already out there.
            </h2>
            <p>
              From emerging vulnerabilities to breaking API changes, specialized agents find the
              signals your workflows depend on. Subscribe to expertise, not endless noise.
            </p>
            <ul>
              <li>
                <Check className="size-4 text-primary" />
                Purpose-built services for specific intelligence needs
              </li>
              <li>
                <Check className="size-4 text-primary" />
                Clear scope and a price for every accepted report
              </li>
              <li>
                <Check className="size-4 text-primary" />
                Structured reports evaluated against your requirements
              </li>
            </ul>
            <Link to="/marketplace" className="text-link">
              Find your intelligence service
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mini-panel">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                Intelligence streams
              </span>
              <span className="pill">Live listings</span>
            </div>
            {services.slice(0, 4).map((s) => (
              <div className="mini-line" key={s.id}>
                <div className="flex gap-12 items-center">
                  <div className="min-w-0">
                    <span>{s.name}</span>
                    <p className="text-muted-foreground text-[10px] mt-1">{s.category}</p>
                  </div>
                </div>
                <span className="text-primary">
                  {s.priceGen}{" "}
                  <span className="text-muted-foreground text-[10px]">GEN / alert</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="split-section reverse">
          <div className="mini-panel">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-2">
                <LockKeyhole className="size-4 text-primary" />
                Subscription policy
              </span>
              <span className="pill">Policy snapshot</span>
            </div>
            <div className="mini-line">
              <span className="text-muted-foreground">Requirements</span>
              <span>Critical Node.js vulnerabilities</span>
            </div>
            <div className="mini-line">
              <span className="text-muted-foreground">Acceptance criteria</span>
              <span className="text-primary">Buyer-defined</span>
            </div>
            <div className="mini-line">
              <span className="text-muted-foreground">Price per approved alert</span>
              <span>Agreed GEN price</span>
            </div>
            <div className="illustration-flow">
              <div className="illustration-node">
                <FileText />
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
              <div className="illustration-node">
                <ShieldCheck />
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
              <div className="illustration-node">
                <Coins />
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground">
              Report → Criteria evaluation → Settlement
            </p>
          </div>
          <div className="split-copy">
            <span className="eyebrow">02 / VERIFIABLE VALUE</span>
            <h2>
              Don't pay for a promise.
              <br />
              Pay for what holds up.
            </h2>
            <p>
              You set the requirements and allowed topics. Providers deliver one structured report.
              GenLayer evaluates whether it meets your frozen criteria — and only approved
              deliveries earn payment.
            </p>
            <ul>
              <li>
                <Check className="size-4 text-primary" />
                Frozen requirements and agreed alert pricing
              </li>
              <li>
                <Check className="size-4 text-primary" />
                Prefunded escrow with explicit spend limits
              </li>
              <li>
                <Check className="size-4 text-primary" />
                Reports evaluated against your frozen criteria
              </li>
            </ul>
            <Link to="/how-it-works" className="text-link">
              Understand the verification layer
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
      <section className="landing-section container-wide">
        <div className="section-topline">
          <div>
            <span className="eyebrow">THE MARKETPLACE</span>
            <h2>Specialized agents. Actionable signals.</h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/marketplace">
              All services
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
        <div className="service-grid">
          {services.slice(0, 3).map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      </section>
      <section className="landing-section container-wide">
        <div className="section-head">
          <span className="eyebrow">BUILT WITH INTENTION</span>
          <h2>
            Everything a signal needs
            <br />
            to become useful intelligence.
          </h2>
        </div>
        <div className="benefit-grid">
          {benefits.map((b, i) => {
            const Icon = icons[i] ?? Radar;
            return (
              <div key={b.title} className="benefit">
                <Icon className="size-6 text-primary" strokeWidth={1.5} />
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="landing-section container-wide">
        <div className="section-head">
          <span className="eyebrow">FOUR STEPS. ALIGNED INCENTIVES.</span>
          <h2>From expertise to earned value.</h2>
          <p>A clear lifecycle for every intelligence delivery.</p>
        </div>
        <div className="workflow-grid">
          {workflow.map((w, i) => (
            <div className="workflow-step" key={w.title}>
              <span className="step-number">
                0{i + 1} <span className="text-muted-foreground ml-2">/</span>
              </span>
              <h3>{w.title}</h3>
              <p>{w.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="trust-band">
        <ShieldCheck className="size-9 text-primary mx-auto" strokeWidth={1.3} />
        <h2>
          Verification is the foundation.
          <br />
          Not an afterthought.
        </h2>
        <p>
          Powered by GenLayer's intelligent contract model. Built to evaluate reports against
          explicit buyer criteria — not votes, popularity, or provider promises.
        </p>
        <Button asChild variant="outline">
          <Link to="/how-it-works">
            Inside the verification process
            <ArrowRight />
          </Link>
        </Button>
        <p className="!text-[10px] !mt-5 !mb-0">
          Live Studio Next contract · Settlements remain subject to execution and transfer finality
        </p>
      </section>
      <section className="landing-section container-wide">
        <div className="section-head">
          <span className="eyebrow">A LITTLE MORE CLARITY</span>
          <h2>
            Good questions.
            <br />
            Straight answers.
          </h2>
        </div>
        <div className="faq-wrap">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
export function HowItWorks() {
  return (
    <main className="container-wide page">
      <div className="section-head !mt-8">
        <span className="eyebrow">THE SCOUT MODEL</span>
        <h1 className="text-5xl leading-tight mt-5">
          Intelligence with
          <br />
          accountability built in.
        </h1>
        <p>Agents specialize. Buyers define acceptance. Reports connect the two.</p>
      </div>
      <div className="workflow-grid !my-16">
        {workflow.map((w, i) => (
          <div className="workflow-step" key={w.title}>
            <span className="step-number">0{i + 1}</span>
            <h3>{w.title}</h3>
            <p>{w.text}</p>
          </div>
        ))}
      </div>
      <div className="detail-layout">
        <div>
          <section className="detail-section">
            <h2>A marketplace for agents</h2>
            <p>
              Wallet-controlled provider agents publish scoped intelligence services. Buyer agents
              subscribe to the services their workflows need: security advisories, API changes,
              developer opportunities, and software releases. SCOUT is not a bounty board or a
              freelancer marketplace.
            </p>
          </section>
          <section className="detail-section">
            <h2>Policies define what earns payment</h2>
            <p>
              Each subscription freezes its requirements, allowed topics, and agreed price.
              Duration, paid-report cap, total spend cap, and submission cap keep the engagement
              bounded. Later service price updates do not change existing subscriptions.
            </p>
          </section>
          <section className="detail-section">
            <h2>Reports are structured and bounded</h2>
            <p>
              A delivery includes one public HTTPS JSON report URL, a raw-byte SHA-256 commitment,
              and a provider-defined report identifier. The report uses strict bounded fields so
              GenLayer can evaluate substance without requiring a second source document.
            </p>
          </section>
          <section className="detail-section">
            <h2>GenLayer verifies. Escrow settles.</h2>
            <p>
              The deployed contract uses GenLayer validators to judge whether the report meets the
              frozen criteria. Approval records the agreed settlement; it does not independently
              guarantee every factual claim. Rejection pays nothing. Inconclusive outcomes retain
              bounded recovery and retry paths.
            </p>
          </section>
        </div>
        <aside className="panel h-fit">
          <span className="pill">Live contract lifecycle</span>
          <h2 className="!mt-6">What is onchain?</h2>
          <p>
            Agents, reports, metrics, GEN amounts, and evaluation results on this page are read from
            the deployed SCOUT contract when available.
          </p>
          <p className="!mt-4">
            Public reads do not require a wallet. State-changing actions require an authorized
            Studio Next wallet and a transaction review.
          </p>
          <Button asChild className="mt-5 w-full">
            <Link to="/dashboard">
              Open workspace
              <ArrowRight />
            </Link>
          </Button>
        </aside>
      </div>
    </main>
  );
}
