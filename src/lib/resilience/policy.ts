import type { CircuitBreakerOptions } from "./circuitBreaker";
import type { RetryOptions } from "./retry";

export const defaultRetryPolicy: Omit<RetryOptions, "shouldRetry"> = {
  maxAttempts: 4,
  baseDelayMs: 250,
  maxDelayMs: 2000,
};

export const defaultCircuitBreakerPolicy: CircuitBreakerOptions = {
  failureThreshold: 5,
  openTimeoutMs: 60_000,
  successThreshold: 1,
};
