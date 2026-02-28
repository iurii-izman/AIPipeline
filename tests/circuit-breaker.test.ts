import { describe, expect, it } from "vitest";
import { CircuitBreakerOpenError, withCircuitBreaker } from "../src/lib/resilience/circuitBreaker";

describe("withCircuitBreaker", () => {
  it("opens after threshold and resets after timeout", async () => {
    let calls = 0;
    const failing = async () => {
      calls += 1;
      throw new Error("upstream failure");
    };

    const guarded = withCircuitBreaker(failing, {
      failureThreshold: 2,
      openTimeoutMs: 20,
      successThreshold: 1,
    });

    await expect(guarded()).rejects.toThrow("upstream failure");
    await expect(guarded()).rejects.toThrow("upstream failure");
    await expect(guarded()).rejects.toBeInstanceOf(CircuitBreakerOpenError);

    await new Promise((r) => setTimeout(r, 25));
    await expect(guarded()).rejects.toThrow("upstream failure");
    expect(calls).toBe(3);
  });
});
