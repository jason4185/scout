import { describe, expect, it } from "vitest";
import {
  formatGen,
  parseGenAmount,
  SCOUT_VIEW_METHODS,
  SCOUT_WRITE_METHODS,
  subscribeWrite,
  submitReportWrite,
} from "./scout";

describe("SCOUT GEN adapter", () => {
  it("uses exact native units without floating point", () => {
    expect(parseGenAmount("2")).toBe(2000000000000000000n);
    expect(parseGenAmount("1.25")).toBe(1250000000000000000n);
    expect(formatGen(2000000000000000000n)).toBe("2");
    expect(formatGen(1250000000000000000n)).toBe("1.25");
  });

  it("rejects more than 18 decimal places", () => {
    expect(() => parseGenAmount("1.0000000000000000001")).toThrow();
  });

  it("maps the SCOUT payable and one-report writes without legacy source arguments", () => {
    const subscription = subscribeWrite({
      buyerAgentId: "1",
      serviceId: "2",
      requirements: "Specific security criteria",
      allowedTopics: "Node.js packages",
      durationSeconds: 86_400n,
      maxPaidAlerts: 2n,
      maxTotalSpendWei: 2_000_000_000_000_000_000n,
      maxSubmissions: 4n,
      value: 2_000_000_000_000_000_000n,
    });
    expect(subscription.method).toBe("subscribe");
    expect(subscription.args).toEqual([
      1n,
      2n,
      "Specific security criteria",
      "Node.js packages",
      86_400n,
      2n,
      2_000_000_000_000_000_000n,
      4n,
    ]);
    expect(subscription.value).toBe(2_000_000_000_000_000_000n);

    const report = submitReportWrite({
      subscriptionId: "3",
      reportId: "sec-2026-001",
      reportUrl: "https://scout-demo.netlify.app/report.json",
      reportSha256: "a".repeat(64),
      metadata: "{}",
    });
    expect(report.method).toBe("submit_alert");
    expect(report.args).toEqual([
      3n,
      "sec-2026-001",
      "https://scout-demo.netlify.app/report.json",
      "a".repeat(64),
      "{}",
    ]);
  });

  it("exposes the complete SCOUT ABI method inventory", () => {
    expect(SCOUT_WRITE_METHODS).toHaveLength(15);
    expect(SCOUT_VIEW_METHODS).toHaveLength(16);
    expect(SCOUT_WRITE_METHODS).toContain("subscribe");
    expect(SCOUT_WRITE_METHODS).toContain("submit_alert");
    expect(SCOUT_VIEW_METHODS).toContain("get_total_activity");
  });
});
