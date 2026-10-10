import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_REPORT_BYTES,
  prepareReport,
  validateReport,
  validateReportId,
  validateReportSha256,
  validateReportUrl,
} from "./report";

afterEach(() => {
  vi.unstubAllGlobals();
});

const report = {
  report_type: "security",
  subject: "Example package",
  event_id: "SEC-2026-001",
  title: "Concrete package risk",
  summary: "A bounded report with a specific finding.",
  findings: ["The package exposes a concrete risk."],
  impact: "Deployments may be affected.",
  recommendations: ["Upgrade and review affected deployments."],
  conclusion: "Remediation is recommended.",
};

describe("SCOUT report boundary", () => {
  it("accepts the exact bounded one-document schema", () => {
    expect(validateReport(report, "sec-2026-001").event_id).toBe("SEC-2026-001");
  });

  it("rejects extra fields and mismatched identifiers", () => {
    expect(() => validateReport({ ...report, source_url: "https://example.org" })).toThrow();
    expect(() => validateReport(report, "different-id")).toThrow(/event_id/);
  });

  it("validates report identifiers and raw-byte digests", () => {
    expect(validateReportId("SEC-2026-001")).toBe("sec-2026-001");
    expect(validateReportSha256("a".repeat(64))).toBe("a".repeat(64));
    expect(() => validateReportId("bad id")).toThrow();
    expect(() => validateReportSha256("A".repeat(64))).toThrow();
    expect(validateReportUrl("https://scout-demo.netlify.app/alert.json")).toBe(
      "https://scout-demo.netlify.app/alert.json",
    );
    expect(() => validateReportUrl("https://user:pass@example.org/report")).toThrow();
  });

  it("hashes the exact response bytes before parsing JSON", async () => {
    const raw = `{
  "report_type": "security",
  "subject": "Example package",
  "event_id": "SEC-2026-001",
  "title": "Concrete package risk",
  "summary": "A bounded report with a specific finding.",
  "findings": ["The package exposes a concrete risk."],
  "impact": "Deployments may be affected.",
  "recommendations": ["Upgrade and review affected deployments."],
  "conclusion": "Remediation is recommended."
}
`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(raw, { status: 200 })),
    );

    const prepared = await prepareReport("https://scout-demo.netlify.app/report.json");

    expect(prepared.size).toBe(402);
    expect(prepared.sha256).toBe(
      "acda7cd5389f6db9f8373c6a35d4ac3f33e179b0367d1528bb5d13dd83e05f69",
    );
    expect(prepared.report.event_id).toBe("SEC-2026-001");
  });

  it("reports browser fetch failures as CORS or network problems", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );

    await expect(prepareReport("https://scout-demo.netlify.app/report.json")).rejects.toMatchObject(
      {
        code: "cors-or-network",
        message: expect.stringMatching(/CORS|cross-origin/),
      },
    );
  });

  it("keeps HTTP, malformed JSON, schema, and size failures distinct", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce(new Response("missing", { status: 404 }));
    await expect(
      prepareReport("https://scout-demo.netlify.app/missing.json"),
    ).rejects.toMatchObject({
      code: "http",
      status: 404,
    });

    fetchMock.mockResolvedValueOnce(new Response("not-json", { status: 200 }));
    await expect(prepareReport("https://scout-demo.netlify.app/bad.json")).rejects.toMatchObject({
      code: "json",
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...report, event_id: undefined }), { status: 200 }),
    );
    await expect(prepareReport("https://scout-demo.netlify.app/schema.json")).rejects.toMatchObject(
      {
        code: "schema",
      },
    );

    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array(MAX_REPORT_BYTES + 1), { status: 200 }),
    );
    await expect(prepareReport("https://scout-demo.netlify.app/large.json")).rejects.toMatchObject({
      code: "too-large",
    });
  });

  it("honors an aborted stale request", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      }),
    );

    const request = prepareReport("https://scout-demo.netlify.app/old.json", controller.signal);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});
