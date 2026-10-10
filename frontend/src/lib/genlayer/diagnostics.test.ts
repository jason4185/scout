import { describe, expect, it, vi } from "vitest";
import { instrumentWalletProvider } from "./diagnostics";

describe("SCOUT transaction diagnostics", () => {
  it("forwards wallet signing requests without changing their parameters", async () => {
    const request = vi.fn().mockResolvedValue("0xtransaction");
    const provider = instrumentWalletProvider(
      { request },
      "0x1234567890abcdef1234567890abcdef12345678",
      61997,
    );

    await expect(
      provider.request({
        method: "eth_sendTransaction",
        params: [{ from: "0x1234567890abcdef1234567890abcdef12345678", value: "0x2" }],
      }),
    ).resolves.toBe("0xtransaction");
    expect(request).toHaveBeenCalledWith({
      method: "eth_sendTransaction",
      params: [{ from: "0x1234567890abcdef1234567890abcdef12345678", value: "0x2" }],
    });
  });

  it("does not swallow wallet rejection", async () => {
    const request = vi.fn().mockRejectedValue({ code: 4001, message: "User rejected" });
    const provider = instrumentWalletProvider(
      { request },
      "0x1234567890abcdef1234567890abcdef12345678",
      61997,
    );

    await expect(provider.request({ method: "eth_sendTransaction" })).rejects.toMatchObject({
      code: 4001,
    });
  });
});
