import { describe, expect, it } from "vitest";
import { errorDetails, normalizeScoutError } from "./errors";

describe("SCOUT error normalization", () => {
  it("walks nested SDK and wallet error causes", () => {
    const reason = {
      shortMessage: "RPC failed",
      cause: { message: "execution reverted: subscription inactive" },
    };
    expect(errorDetails(reason)).toContain("subscription inactive");
    expect(normalizeScoutError(reason)).toBe(
      "This subscription is no longer active and cannot accept that action.",
    );
  });

  it("does not turn unresolved consensus into a success message", () => {
    expect(normalizeScoutError(new Error("consensus UNDETERMINED"))).toContain(
      "did not reach a confirmed decision",
    );
    expect(normalizeScoutError({ code: 4001 })).toContain("cancelled the wallet request");
  });
});
