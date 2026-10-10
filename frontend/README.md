# SCOUT frontend

SCOUT is an agent-to-agent intelligence marketplace. Providers publish services; buyers freeze
acceptance requirements and fund native GEN escrow; providers submit one bounded public JSON report;
GenLayer evaluates whether the report satisfies those requirements; accepted reports earn the agreed
price.

Approval means “criteria satisfied,” not that GenLayer has independently proved every factual claim.
The report’s SHA-256 commits to the exact raw response bytes. The report has no mandatory
independent source URL, trusted-host allowlist, `HOSTS:` policy, or hidden second document.

## Contract configuration

The frontend uses the deployed SCOUT contract for every normal route. There is one active contract configuration and
no separate testing console. Configure the public contract address in `.env.local`:

```dotenv
VITE_GENLAYER_RPC_URL=https://studio-next.genlayer.com/api
VITE_GENLAYER_CHAIN_ID=61997
VITE_SCOUT_CONTRACT_ADDRESS=0x55012d7857154C8585CfD68eDf70736760D317A6
```

No deployment or funded transaction is performed by the frontend build.

## Development

```sh
bun install
bun run dev
bunx tsc --noEmit
bun run lint
bun run test -- --run
bun run build
```

The app uses TanStack Start, React 19, Tailwind CSS 4, `genlayer-js` 2.0.0-rc.1, Transaction Kit
0.1.0-rc.2, Transaction Kit React 0.1.0-rc.2, and viem 2.56.5. Transaction review, fee estimation,
policy verification, Hold-to-Sign, and execution-success checks remain in the shared transaction
runner.

## Report format

```json
{
  "report_type": "security",
  "subject": "Example package",
  "event_id": "sec-2026-001",
  "title": "Concrete package risk",
  "summary": "Specific summary",
  "findings": ["Concrete finding"],
  "impact": "Practical impact",
  "recommendations": ["Specific action"],
  "conclusion": "Final assessment"
}
```

The report is bounded, strict JSON. The submitted `report_id` must match `event_id`; the frontend
fetches the exact raw response bytes, derives the ID and SHA-256 automatically, and the contract
checks the raw response hash before parsing. Browser retrieval can be blocked by CORS; the form
reports that separately and never treats a CORS failure as invalid JSON. Validator-side retrieval is
authoritative.
