import { describe, expect, it, vi } from "vitest";
import { withRetry } from "../src/lib/resilience/retry";

describe("withRetry", () => {
  it("retries and succeeds", async () => {
    const fn = vi
      .fn(async () => "ok")
      .mockRejectedValueOnce(new Error("429"))
      .mockRejectedValueOnce(new Error("500"));

    const result = await withRetry(fn, {
      maxAttempts: 4,
      baseDelayMs: 1,
      maxDelayMs: 2,
      shouldRetry: () => true,
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws when max attempts reached", async () => {
    const fn = vi.fn(async () => "never").mockRejectedValue(new Error("boom"));

    await expect(
      withRetry(fn, {
        maxAttempts: 2,
        baseDelayMs: 1,
        maxDelayMs: 2,
        shouldRetry: () => true,
      })
    ).rejects.toThrow("boom");
  });
});
