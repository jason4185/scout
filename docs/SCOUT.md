# SCOUT contract and frontend handoff

## Contract ABI boundary

The active contract exposes 15 write methods and 16 view methods of the SCOUT marketplace. The only
business-logic argument changes are intentional:

- `subscribe(u256 buyer_agent_id, u256 service_id, str requirements, str allowed_topics,
  u256 duration_seconds, u256 max_paid_alerts, u256 max_total_spend, u256 max_submissions)` is
  payable. It has no evidence-standard or trusted-host parameter.
- `submit_alert(u256 subscription_id, str report_id, str report_url, str report_sha256, str metadata)`
  is non-payable. It has one report URL and no independent source URL.

All other write signatures are unchanged: agent registration/management, service creation/update,
subscription funding/cancellation/expiry/refund, delivery evaluation, and inconclusive resolution.
The views retain their names and pagination parameters, while subscription views omit
`evidence_standard`; delivery views return `report_id`, `report_url`, `report_sha256`, and
`metadata` rather than legacy alert/source fields. `get_config` returns `report_policy` and
`report_format` with the criteria-evaluation description.

## Bounded report schema

The report must be a JSON object with exactly these keys:

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

Strings and arrays are bounded in `Scout.py`; findings and recommendations contain one to eight
items. The report body is limited to 16,384 bytes. `event_id` must match the submitted normalized
report ID. The contract hashes raw response bytes before UTF-8 decoding or JSON parsing, rejects
visible redirects, requires a successful HTTP response, and fails closed for malformed JSON or
schema violations. It does not infer truth from a hash.

## Evaluation and settlement

The leader and validator both independently fetch the same report and run the same criteria prompt
through `gl.vm.run_nondet`. Report and metadata content are delimited as untrusted data; embedded
instructions, role claims, and claimed scores are not evaluator instructions. Strict output parsing
accepts only `APPROVED`, `REJECTED`, or `INCONCLUSIVE`. Any exception, malformed output, retrieval
failure, or validator disagreement cannot authorize payment.

`APPROVED` means the consensus evaluator found substantive relevance, completeness, specificity,
coherence, actionability when requested, scope, originality, and instruction compliance. It does not
mean independent fact verification. `REJECTED` releases the reserved report price. `INCONCLUSIVE`
preserves the reservation for bounded retries and then permissionless recovery. Cancellation/expiry
recovery waits 3,600 seconds for pending reports.

The settlement invariant is preserved for every subscription:

```text
total_funded = available_escrow + reserved_escrow + total_paid + total_refunded
```

Approved GEN transfers use the existing asynchronous external-message mechanism and are recorded as
`QUEUED`; a queued message is not presented as a confirmed wallet receipt.

## Duplicate limits

Within one subscription the contract rejects duplicate normalized report IDs, normalized HTTPS URLs,
and exact lowercase SHA-256 digests. Previous delivery context is bounded to eight records and
explicitly excludes the delivery currently being evaluated, including retries. A provider can still
evade semantic duplicate detection by changing the wording, ID, URL, and digest; SCOUT does not claim
perfect semantic deduplication.

## Active deployment and manual testing

1. The active deployment is `0x55012d7857154C8585CfD68eDf70736760D317A6` on chain `61997`.
2. Run read-only calls (`get_config`, `get_total_activity`, `get_agents`, `get_services`).
3. Configure `VITE_SCOUT_CONTRACT_ADDRESS` with that public address.
4. Register fresh agents and create services on the active deployment; state from another deployment
   is not migrated.
5. Perform the manual lifecycle: subscribe/fund, host one JSON report, submit its URL after the
   frontend derives the hash and event ID, evaluate, inspect the decision, and independently check
   queued transfer/refund finality.

No deployment or paid transaction is automatic.
