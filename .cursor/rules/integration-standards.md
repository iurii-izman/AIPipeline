# Integration Standards

1. ALL external API calls MUST be idempotent (use idempotency keys)
2. Retry policy: 3 attempts, exponential backoff (1s, 4s, 16s)
3. Circuit breaker: open after 5 failures in 60s
4. Dead Letter Queue for failed messages after retries exhausted
5. Structured error logging: { errorCode, source, entity, idempotencyKey, attempt }
6. Response timeout: 30s for sync, 5min for async operations
7. Rate limiting: respect upstream limits, implement client-side throttle
8. Data validation at boundaries: validate input AND output schemas
