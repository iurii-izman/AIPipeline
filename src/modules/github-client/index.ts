import { loadConfig } from "../../config/env";
import {
  CircuitBreakerOpenError,
  defaultCircuitBreakerPolicy,
  defaultRetryPolicy,
  withCircuitBreaker,
  withRetry,
} from "../../lib/resilience";
import { fetchWithTimeout, type RequestOptions } from "../../lib/http/fetchWithTimeout";

export type GitHubRepository = {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
};

export type GitHubWorkflowRun = {
  id: number;
  name?: string;
  status?: string;
  conclusion?: string | null;
  htmlUrl?: string;
  headBranch?: string;
  createdAt?: string;
};

export type DispatchWorkflowInput = {
  workflow: string;
  ref: string;
  inputs?: Record<string, string>;
};

export type DispatchWorkflowResult = {
  accepted: boolean;
  deduplicated: boolean;
  workflow: string;
  ref: string;
};

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type GitHubClientOptions = {
  token?: string;
  owner?: string;
  repo?: string;
  fetcher?: Fetcher;
  defaultTimeoutMs?: number;
};

export class GitHubError extends Error {
  public readonly status?: number;
  public readonly retryable: boolean;
  public readonly code: "NETWORK" | "RATE_LIMIT" | "UPSTREAM" | "BAD_RESPONSE" | "CIRCUIT_OPEN";

  constructor(params: {
    message: string;
    code: GitHubError["code"];
    retryable: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "GitHubError";
    this.code = params.code;
    this.retryable = params.retryable;
    this.status = params.status;
    if (params.cause) {
      (this as Error & { cause?: unknown }).cause = params.cause;
    }
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function toGitHubError(error: unknown): GitHubError {
  if (error instanceof GitHubError) return error;
  if (error instanceof CircuitBreakerOpenError) {
    return new GitHubError({
      message: error.message,
      code: "CIRCUIT_OPEN",
      retryable: true,
      cause: error,
    });
  }
  return new GitHubError({
    message: error instanceof Error ? error.message : "Unknown network error",
    code: "NETWORK",
    retryable: true,
    cause: error,
  });
}

export class GitHubClient {
  private readonly token: string;
  private readonly owner: string;
  private readonly repo: string;
  private readonly fetcher: Fetcher;
  private readonly executeWithBreaker: <T>(operation: () => Promise<T>) => Promise<T>;
  private readonly endpoint = "https://api.github.com";
  private readonly dispatchIdempotencyKeys = new Set<string>();
  private readonly defaultTimeoutMs?: number;

  constructor(options?: GitHubClientOptions) {
    const cfg = loadConfig({ requireGithub: true });
    this.token = options?.token ?? cfg.githubToken!;
    this.owner = options?.owner ?? cfg.githubOwner!;
    this.repo = options?.repo ?? cfg.githubRepo!;
    this.fetcher = options?.fetcher ?? fetch;
    this.defaultTimeoutMs = options?.defaultTimeoutMs;
    const guarded = withCircuitBreaker(
      async <T>(operation: () => Promise<T>) => operation(),
      defaultCircuitBreakerPolicy
    );
    this.executeWithBreaker = guarded as <T>(operation: () => Promise<T>) => Promise<T>;
  }

  private async runRequest<T>(
    path: string,
    init?: RequestInit,
    errorContext = "GitHub request failed",
    requestOptions?: RequestOptions
  ): Promise<T> {
    const execute = () =>
      withRetry(
        async () => {
          let response: Response;
          try {
            response = await fetchWithTimeout(
              this.fetcher,
              `${this.endpoint}${path}`,
              {
                ...init,
                headers: {
                  Authorization: `Bearer ${this.token}`,
                  Accept: "application/vnd.github+json",
                  "User-Agent": "AIPipeline-GitHubClient",
                  "X-GitHub-Api-Version": "2022-11-28",
                  ...(init?.headers ?? {}),
                },
              },
              {
                timeoutMs: requestOptions?.timeoutMs ?? this.defaultTimeoutMs,
                signal: requestOptions?.signal,
              }
            );
          } catch (error) {
            throw new GitHubError({
              message: `${errorContext} at network layer`,
              code: "NETWORK",
              retryable: true,
              cause: error,
            });
          }

          const text = await response.text();
          let payload: unknown = {};
          if (text) {
            try {
              payload = JSON.parse(text);
            } catch {
              payload = { message: text };
            }
          }

          if (!response.ok) {
            const message =
              payload && typeof payload === "object" && typeof (payload as { message?: unknown }).message === "string"
                ? String((payload as { message?: unknown }).message)
                : `GitHub HTTP ${response.status}`;
            throw new GitHubError({
              message: `${errorContext}: ${message}`,
              code: response.status === 429 ? "RATE_LIMIT" : "UPSTREAM",
              retryable: isRetryableStatus(response.status),
              status: response.status,
            });
          }

          if (!payload || typeof payload !== "object") {
            throw new GitHubError({
              message: `${errorContext}: invalid JSON payload`,
              code: "BAD_RESPONSE",
              retryable: false,
              status: response.status,
            });
          }

          return payload as T;
        },
        {
          ...defaultRetryPolicy,
          shouldRetry: (error) => toGitHubError(error).retryable,
        }
      );

    try {
      return await this.executeWithBreaker(execute);
    } catch (error) {
      throw toGitHubError(error);
    }
  }

  async getRepository(requestOptions?: RequestOptions): Promise<GitHubRepository> {
    const payload = await this.runRequest<Record<string, unknown>>(
      `/repos/${this.owner}/${this.repo}`,
      { method: "GET" },
      "GitHub get repository failed",
      requestOptions
    );

    if (typeof payload.id !== "number" || typeof payload.full_name !== "string" || typeof payload.default_branch !== "string") {
      throw new GitHubError({
        message: "GitHub get repository failed: missing required fields",
        code: "BAD_RESPONSE",
        retryable: false,
      });
    }

    return {
      id: payload.id,
      fullName: payload.full_name,
      private: Boolean(payload.private),
      defaultBranch: payload.default_branch,
    };
  }

  async dispatchWorkflow(
    input: DispatchWorkflowInput,
    idempotencyKey?: string,
    requestOptions?: RequestOptions
  ): Promise<DispatchWorkflowResult> {
    if (idempotencyKey && this.dispatchIdempotencyKeys.has(idempotencyKey)) {
      return {
        accepted: true,
        deduplicated: true,
        workflow: input.workflow,
        ref: input.ref,
      };
    }

    await this.runRequest<Record<string, unknown>>(
      `/repos/${this.owner}/${this.repo}/actions/workflows/${encodeURIComponent(input.workflow)}/dispatches`,
      {
        method: "POST",
        headers: idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : undefined,
        body: JSON.stringify({
          ref: input.ref,
          ...(input.inputs ? { inputs: input.inputs } : {}),
        }),
      },
      "GitHub workflow dispatch failed",
      requestOptions
    );

    if (idempotencyKey) {
      this.dispatchIdempotencyKeys.add(idempotencyKey);
    }

    return {
      accepted: true,
      deduplicated: false,
      workflow: input.workflow,
      ref: input.ref,
    };
  }

  async listWorkflowRuns(workflow: string, limit = 10, requestOptions?: RequestOptions): Promise<GitHubWorkflowRun[]> {
    const payload = await this.runRequest<Record<string, unknown>>(
      `/repos/${this.owner}/${this.repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=${encodeURIComponent(
        String(limit)
      )}`,
      { method: "GET" },
      "GitHub list workflow runs failed",
      requestOptions
    );

    const rawRuns = Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];
    return rawRuns.reduce<GitHubWorkflowRun[]>((acc, row) => {
      if (!row || typeof row !== "object") return acc;
      const run = row as Record<string, unknown>;
      if (typeof run.id !== "number") return acc;
      acc.push({
          id: run.id,
          name: typeof run.name === "string" ? run.name : undefined,
          status: typeof run.status === "string" ? run.status : undefined,
          conclusion: typeof run.conclusion === "string" || run.conclusion === null ? run.conclusion : undefined,
          htmlUrl: typeof run.html_url === "string" ? run.html_url : undefined,
          headBranch: typeof run.head_branch === "string" ? run.head_branch : undefined,
          createdAt: typeof run.created_at === "string" ? run.created_at : undefined,
        });
      return acc;
    }, []);
  }
}
