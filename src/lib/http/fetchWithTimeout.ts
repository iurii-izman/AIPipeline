export class RequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "RequestTimeoutError";
  }
}

export type RequestOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function createTimeoutSignal(options?: RequestOptions): { signal?: AbortSignal; cleanup: () => void } {
  const timeoutMs = options?.timeoutMs;
  const externalSignal = options?.signal;
  if (!timeoutMs && !externalSignal) {
    return { signal: undefined, cleanup: () => {} };
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const onExternalAbort = () => {
    if (!controller.signal.aborted) controller.abort(externalSignal?.reason);
  };

  if (externalSignal?.aborted) {
    controller.abort(externalSignal.reason);
  } else if (externalSignal) {
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) controller.abort(new RequestTimeoutError(timeoutMs));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
    },
  };
}

function normalizeError(error: unknown, timeoutMs?: number): unknown {
  if (timeoutMs && error instanceof DOMException && error.name === "AbortError") {
    return new RequestTimeoutError(timeoutMs);
  }
  return error;
}

export async function fetchWithTimeout(
  fetcher: Fetcher,
  input: string,
  init?: RequestInit,
  options?: RequestOptions
): Promise<Response> {
  const { signal, cleanup } = createTimeoutSignal(options);
  const timeoutMs = options?.timeoutMs;
  try {
    return await fetcher(input, {
      ...init,
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    throw normalizeError(error, timeoutMs);
  } finally {
    cleanup();
  }
}
