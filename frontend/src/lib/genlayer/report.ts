export const MAX_REPORT_BYTES = 16_384;
export const MAX_REPORT_ITEMS = 8;

export type ReportPreparationErrorCode =
  | "invalid-url"
  | "cors-or-network"
  | "http"
  | "response"
  | "too-large"
  | "empty"
  | "encoding"
  | "crypto"
  | "json"
  | "schema";

export class ReportPreparationError extends Error {
  readonly code: ReportPreparationErrorCode;
  readonly status: number | undefined;

  constructor(code: ReportPreparationErrorCode, message: string, status?: number) {
    super(message);
    this.name = "ReportPreparationError";
    this.code = code;
    this.status = status;
  }
}

export type ScoutReport = {
  report_type: string;
  subject: string;
  event_id: string;
  title: string;
  summary: string;
  findings: string[];
  impact: string;
  recommendations: string[];
  conclusion: string;
};

export type PreparedReport = {
  url: string;
  sha256: string;
  size: number;
  report: ScoutReport;
};

export function isReportAbort(reason: unknown) {
  return (
    (typeof DOMException !== "undefined" &&
      reason instanceof DOMException &&
      reason.name === "AbortError") ||
    (reason instanceof Error && reason.name === "AbortError")
  );
}

function text(value: unknown, max: number, field: string) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    new TextEncoder().encode(value).byteLength > max
  )
    throw new Error(`${field} must be a non-empty string within its size limit.`);
  if (
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
    })
  )
    throw new Error(`${field} contains a control character.`);
  return value;
}

function items(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_REPORT_ITEMS)
    throw new Error(`${field} must contain one to ${MAX_REPORT_ITEMS} items.`);
  return value.map((item) => text(item, 600, `${field} item`));
}

export function validateReport(value: unknown, expectedReportId?: string): ScoutReport {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Report must be a JSON object.");
  const report = value as Record<string, unknown>;
  const keys = Object.keys(report).sort().join(",");
  if (
    keys !== "conclusion,event_id,findings,impact,recommendations,report_type,subject,summary,title"
  )
    throw new Error("Report must contain exactly the required SCOUT fields.");
  const reportType = text(report["report_type"], 80, "report_type");
  if (!/^[a-z0-9_]+$/.test(reportType))
    throw new Error("report_type must use lowercase letters, numbers, or underscores.");
  const eventId = text(report["event_id"], 160, "event_id");
  if (expectedReportId && eventId.toLowerCase() !== expectedReportId.trim().toLowerCase())
    throw new Error("Report event_id must match the submitted report identifier.");
  return {
    report_type: reportType,
    subject: text(report["subject"], 240, "subject"),
    event_id: eventId,
    title: text(report["title"], 200, "title"),
    summary: text(report["summary"], 1200, "summary"),
    findings: items(report["findings"], "findings"),
    impact: text(report["impact"], 1200, "impact"),
    recommendations: items(report["recommendations"], "recommendations"),
    conclusion: text(report["conclusion"], 1200, "conclusion"),
  };
}

export function validateReportId(value: string) {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed !== value ||
    /\s/.test(trimmed) ||
    new TextEncoder().encode(trimmed).byteLength > 160
  )
    throw new Error("Report ID must be non-empty, whitespace-free, and at most 160 bytes.");
  return trimmed.toLowerCase();
}

export function validateReportSha256(value: string) {
  if (!/^[0-9a-f]{64}$/.test(value))
    throw new Error("Report SHA-256 must be lowercase hexadecimal.");
  return value;
}

export function validateReportUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed !== value || new TextEncoder().encode(trimmed).byteLength > 500)
    throw new Error("Report URL must be a valid HTTPS URL.");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Report URL must be a valid HTTPS URL.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    (parsed.port && parsed.port !== "443") ||
    /\s/.test(trimmed) ||
    [...parsed.hostname].some((character) => character.charCodeAt(0) > 127)
  )
    throw new Error(
      "Report URL must use HTTPS without credentials, fragments, ports, or whitespace.",
    );
  const host = parsed.hostname.toLowerCase();
  if (
    host.endsWith(".") ||
    host.includes("..") ||
    !host ||
    host
      .split(".")
      .some(
        (label) =>
          !label || label.startsWith("-") || label.endsWith("-") || !/^[a-z0-9-]+$/.test(label),
      )
  )
    throw new Error("Report URL must use a valid public hostname.");
  return trimmed;
}

export async function prepareReport(url: string, signal?: AbortSignal): Promise<PreparedReport> {
  let normalized: string;
  try {
    normalized = validateReportUrl(url);
  } catch (reason) {
    throw new ReportPreparationError(
      "invalid-url",
      reason instanceof Error ? reason.message : "Report URL must be a valid HTTPS URL.",
    );
  }
  let response: Response;
  try {
    response = await fetch(normalized, {
      cache: "no-store",
      credentials: "omit",
      ...(signal ? { signal } : {}),
    });
  } catch (reason) {
    if (isReportAbort(reason)) throw reason;
    throw new ReportPreparationError(
      "cors-or-network",
      "The browser could not read this report. The host may be unavailable or its CORS policy may block cross-origin GET requests. For Netlify, add an _headers rule that sends Access-Control-Allow-Origin: * (or this app's origin). This is not an invalid-JSON result.",
    );
  }

  if (!response.ok || response.status < 200 || response.status >= 300) {
    throw new ReportPreparationError(
      "http",
      `The report URL returned HTTP ${response.status}. Check that the Netlify file exists and is public.`,
      response.status,
    );
  }
  if (!response.body)
    throw new ReportPreparationError("response", "The report response had no readable body.");

  const contentLength = response.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_REPORT_BYTES) {
    await response.body.cancel();
    throw new ReportPreparationError(
      "too-large",
      `Reports must be ${MAX_REPORT_BYTES.toLocaleString()} bytes or smaller.`,
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_REPORT_BYTES) {
        await reader.cancel();
        throw new ReportPreparationError(
          "too-large",
          `Reports must be ${MAX_REPORT_BYTES.toLocaleString()} bytes or smaller.`,
        );
      }
      chunks.push(value);
    }
  } catch (reason) {
    if (isReportAbort(reason)) throw reason;
    if (reason instanceof ReportPreparationError) throw reason;
    throw new ReportPreparationError(
      "response",
      "The report response could not be read completely. Check the host connection and try again.",
    );
  } finally {
    reader.releaseLock();
  }
  if (!total) throw new ReportPreparationError("empty", "Report responses must not be empty.");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let textValue: string;
  try {
    textValue = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ReportPreparationError("encoding", "The report is not valid UTF-8 JSON.");
  }

  if (!globalThis.crypto?.subtle)
    throw new ReportPreparationError(
      "crypto",
      "This browser does not provide Web Crypto SHA-256 support, so the report cannot be prepared safely.",
    );
  let digest: ArrayBuffer;
  try {
    digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  } catch {
    throw new ReportPreparationError(
      "crypto",
      "The browser could not calculate SHA-256 with Web Crypto, so the report cannot be prepared safely.",
    );
  }
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  let parsed: unknown;
  try {
    parsed = JSON.parse(textValue);
  } catch {
    throw new ReportPreparationError("json", "The downloaded report is not valid JSON.");
  }

  let report: ScoutReport;
  try {
    report = validateReport(parsed);
  } catch (reason) {
    throw new ReportPreparationError(
      "schema",
      reason instanceof Error
        ? `The report JSON is invalid: ${reason.message}`
        : "The report JSON does not match the SCOUT schema.",
    );
  }
  return { url: normalized, sha256, size: bytes.byteLength, report };
}
