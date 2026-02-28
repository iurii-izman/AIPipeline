export type CircuitState = "closed" | "open" | "half_open";

export type CircuitBreakerOptions = {
  failureThreshold: number;
  openTimeoutMs: number;
  successThreshold: number;
  shouldTrip?: (error: unknown) => boolean;
};

export class CircuitBreakerOpenError extends Error {
  constructor() {
    super("Circuit breaker is open");
    this.name = "CircuitBreakerOpenError";
  }
}

export function withCircuitBreaker<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => Promise<TResult>,
  options: CircuitBreakerOptions
): (...args: TArgs) => Promise<TResult> {
  let state: CircuitState = "closed";
  let failureCount = 0;
  let successCount = 0;
  let openedAt = 0;

  const shouldTrip = options.shouldTrip ?? (() => true);

  function transitionToOpen() {
    state = "open";
    openedAt = Date.now();
    failureCount = 0;
    successCount = 0;
  }

  function transitionToClosed() {
    state = "closed";
    failureCount = 0;
    successCount = 0;
    openedAt = 0;
  }

  return async (...args: TArgs): Promise<TResult> => {
    if (state === "open") {
      const elapsed = Date.now() - openedAt;
      if (elapsed < options.openTimeoutMs) {
        throw new CircuitBreakerOpenError();
      }
      state = "half_open";
      successCount = 0;
    }

    try {
      const result = await operation(...args);
      if (state === "half_open") {
        successCount += 1;
        if (successCount >= options.successThreshold) transitionToClosed();
      } else {
        failureCount = 0;
      }
      return result;
    } catch (error) {
      if (shouldTrip(error)) {
        failureCount += 1;
        if (state === "half_open" || failureCount >= options.failureThreshold) {
          transitionToOpen();
        }
      }
      throw error;
    }
  };
}
