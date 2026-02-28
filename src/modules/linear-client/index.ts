import { loadConfig } from "../../config/env";
import {
  CircuitBreakerOpenError,
  defaultCircuitBreakerPolicy,
  defaultRetryPolicy,
  withCircuitBreaker,
  withRetry,
} from "../../lib/resilience";

export type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  state?: { name?: string; type?: string };
  url?: string;
};

export type LinearCreateIssueInput = {
  teamId: string;
  title: string;
  description?: string;
  priority?: number;
};

export class LinearError extends Error {
  public readonly status?: number;
  public readonly retryable: boolean;
  public readonly code: "NETWORK" | "RATE_LIMIT" | "UPSTREAM" | "BAD_RESPONSE" | "CIRCUIT_OPEN";

  constructor(params: {
    message: string;
    code: LinearError["code"];
    retryable: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "LinearError";
    this.code = params.code;
    this.retryable = params.retryable;
    this.status = params.status;
    if (params.cause) {
      (this as Error & { cause?: unknown }).cause = params.cause;
    }
  }
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type LinearClientOptions = {
  apiKey?: string;
  fetcher?: Fetcher;
};

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function toLinearError(error: unknown): LinearError {
  if (error instanceof LinearError) return error;
  if (error instanceof CircuitBreakerOpenError) {
    return new LinearError({
      message: error.message,
      code: "CIRCUIT_OPEN",
      retryable: true,
      cause: error,
    });
  }
  return new LinearError({
    message: error instanceof Error ? error.message : "Unknown network error",
    code: "NETWORK",
    retryable: true,
    cause: error,
  });
}

export class LinearClient {
  private readonly apiKey: string;
  private readonly fetcher: Fetcher;
  private readonly endpoint = "https://api.linear.app/graphql";
  private readonly executeWithBreaker: <T>(operation: () => Promise<T>) => Promise<T>;

  constructor(options?: LinearClientOptions) {
    const cfg = loadConfig({ requireLinear: true });
    this.apiKey = options?.apiKey ?? cfg.linearApiKey!;
    this.fetcher = options?.fetcher ?? fetch;
    const guarded = withCircuitBreaker(
      async <T>(operation: () => Promise<T>) => {
        return operation();
      },
      defaultCircuitBreakerPolicy
    );
    this.executeWithBreaker = guarded as <T>(operation: () => Promise<T>) => Promise<T>;
  }

  private async runGraphQL<TData>(query: string, variables: Record<string, unknown>, idempotencyKey?: string): Promise<TData> {
    const execute = () =>
      withRetry(
        async () => {
          let response: Response;
          try {
            response = await this.fetcher(this.endpoint, {
              method: "POST",
              headers: {
                Authorization: this.apiKey,
                "Content-Type": "application/json",
                ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
              },
              body: JSON.stringify({ query, variables }),
            });
          } catch (error) {
            throw new LinearError({
              message: "Linear request failed at network layer",
              code: "NETWORK",
              retryable: true,
              cause: error,
            });
          }

          const payload = (await response.json()) as { data?: TData; errors?: Array<{ message?: string }> };

          if (!response.ok) {
            throw new LinearError({
              message: payload.errors?.[0]?.message || `Linear HTTP ${response.status}`,
              code: response.status === 429 ? "RATE_LIMIT" : "UPSTREAM",
              retryable: isRetryableStatus(response.status),
              status: response.status,
            });
          }

          if (payload.errors?.length) {
            throw new LinearError({
              message: payload.errors[0].message || "Linear GraphQL error",
              code: "BAD_RESPONSE",
              retryable: false,
              status: response.status,
            });
          }

          if (!payload.data) {
            throw new LinearError({
              message: "Linear response missing data",
              code: "BAD_RESPONSE",
              retryable: false,
              status: response.status,
            });
          }

          return payload.data;
        },
        {
          ...defaultRetryPolicy,
          shouldRetry: (error) => {
            const e = toLinearError(error);
            return e.retryable;
          },
        }
      );

    try {
      return await this.executeWithBreaker(execute);
    } catch (error) {
      throw toLinearError(error);
    }
  }

  async findIssue(identifier: string): Promise<LinearIssue | null> {
    const data = await this.runGraphQL<{ issues: { nodes: LinearIssue[] } }>(
      "query($identifier:String!){issues(filter:{identifier:{eq:$identifier}},first:1){nodes{id identifier title state{name type} url}}}",
      { identifier }
    );
    return data.issues.nodes[0] ?? null;
  }

  async updateIssueState(issueId: string, stateId: string, idempotencyKey?: string): Promise<LinearIssue> {
    const data = await this.runGraphQL<{ issueUpdate: { success: boolean; issue: LinearIssue } }>(
      "mutation($id:String!,$stateId:String!){issueUpdate(id:$id,input:{stateId:$stateId}){success issue{id identifier title state{name type} url}}}",
      { id: issueId, stateId },
      idempotencyKey
    );
    if (!data.issueUpdate.success) {
      throw new LinearError({
        message: "Linear issue update returned success=false",
        code: "BAD_RESPONSE",
        retryable: false,
      });
    }
    return data.issueUpdate.issue;
  }

  async createIssue(input: LinearCreateIssueInput, idempotencyKey?: string): Promise<LinearIssue> {
    const data = await this.runGraphQL<{ issueCreate: { success: boolean; issue: LinearIssue } }>(
      "mutation($input:IssueCreateInput!){issueCreate(input:$input){success issue{id identifier title state{name type} url}}}",
      { input },
      idempotencyKey
    );
    if (!data.issueCreate.success) {
      throw new LinearError({
        message: "Linear issue create returned success=false",
        code: "BAD_RESPONSE",
        retryable: false,
      });
    }
    return data.issueCreate.issue;
  }

  async listIssues(limit = 50): Promise<LinearIssue[]> {
    const data = await this.runGraphQL<{ issues: { nodes: LinearIssue[] } }>(
      "query($first:Int!){issues(first:$first){nodes{id identifier title state{name type} url}}}",
      { first: limit }
    );
    return data.issues.nodes;
  }
}
