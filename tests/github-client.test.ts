import { afterEach, describe, expect, it } from "vitest";
import { GitHubClient, GitHubError } from "../src/modules/github-client";

function makeResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GitHubClient", () => {
  const originalStoreFile = process.env.IDEMPOTENCY_STORE_FILE;

  function resetStoreEnv(pathValue?: string): void {
    if (pathValue === undefined) {
      delete process.env.IDEMPOTENCY_STORE_FILE;
      return;
    }
    process.env.IDEMPOTENCY_STORE_FILE = pathValue;
  }

  afterEach(() => {
    resetStoreEnv(originalStoreFile);
  });

  it("getRepository returns mapped repository on happy path", async () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_test";
    process.env.GITHUB_OWNER = "iurii-izman";
    process.env.GITHUB_REPO = "AIPipeline";

    const client = new GitHubClient({
      fetcher: async () =>
        makeResponse(200, {
          id: 123,
          full_name: "iurii-izman/AIPipeline",
          private: false,
          default_branch: "main",
        }),
    });

    const repo = await client.getRepository();
    expect(repo).toEqual({
      id: 123,
      fullName: "iurii-izman/AIPipeline",
      private: false,
      defaultBranch: "main",
    });
  });

  it("retries on 429 and then succeeds", async () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_test";
    process.env.GITHUB_OWNER = "iurii-izman";
    process.env.GITHUB_REPO = "AIPipeline";

    let calls = 0;
    const client = new GitHubClient({
      fetcher: async () => {
        calls += 1;
        if (calls === 1) return makeResponse(429, { message: "rate limited" });
        return makeResponse(200, { workflow_runs: [] });
      },
    });

    const runs = await client.listWorkflowRuns("deploy-staging.yml", 5);
    expect(runs).toEqual([]);
    expect(calls).toBe(2);
  });

  it("dispatchWorkflow enforces idempotency for repeated key", async () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_test";
    process.env.GITHUB_OWNER = "iurii-izman";
    process.env.GITHUB_REPO = "AIPipeline";
    process.env.IDEMPOTENCY_STORE_FILE = `.out/tests/idempotency-basic-${Date.now()}.json`;

    let calls = 0;
    const client = new GitHubClient({
      fetcher: async () => {
        calls += 1;
        return makeResponse(200, {});
      },
    });

    const first = await client.dispatchWorkflow(
      { workflow: "deploy-staging.yml", ref: "main" },
      "idem-1"
    );
    const second = await client.dispatchWorkflow(
      { workflow: "deploy-staging.yml", ref: "main" },
      "idem-1"
    );

    expect(first).toEqual({
      accepted: true,
      deduplicated: false,
      workflow: "deploy-staging.yml",
      ref: "main",
    });
    expect(second).toEqual({
      accepted: true,
      deduplicated: true,
      workflow: "deploy-staging.yml",
      ref: "main",
    });
    expect(calls).toBe(1);
  });

  it("dispatchWorkflow idempotency survives client re-instantiation via file store", async () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_test";
    process.env.GITHUB_OWNER = "iurii-izman";
    process.env.GITHUB_REPO = "AIPipeline";
    process.env.IDEMPOTENCY_STORE_FILE = `.out/tests/idempotency-${Date.now()}.json`;

    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return makeResponse(200, {});
    };

    const clientA = new GitHubClient({ fetcher });
    await clientA.dispatchWorkflow({ workflow: "deploy-staging.yml", ref: "main" }, "idem-persist-1");

    const clientB = new GitHubClient({ fetcher });
    const second = await clientB.dispatchWorkflow({ workflow: "deploy-staging.yml", ref: "main" }, "idem-persist-1");
    expect(second.deduplicated).toBe(true);
    expect(calls).toBe(1);
  });

  it("opens circuit breaker after repeated non-retryable upstream failures", async () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_test";
    process.env.GITHUB_OWNER = "iurii-izman";
    process.env.GITHUB_REPO = "AIPipeline";

    const client = new GitHubClient({
      fetcher: async () => makeResponse(403, { message: "forbidden" }),
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(client.getRepository()).rejects.toBeInstanceOf(GitHubError);
    }

    await expect(client.getRepository()).rejects.toMatchObject({ code: "CIRCUIT_OPEN" });
  });

  it("throws typed network error", async () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_test";
    process.env.GITHUB_OWNER = "iurii-izman";
    process.env.GITHUB_REPO = "AIPipeline";

    const client = new GitHubClient({
      fetcher: async () => {
        throw new Error("network timeout");
      },
    });

    await expect(client.getRepository()).rejects.toMatchObject({ code: "NETWORK", retryable: true });
  });

  it("times out request when timeoutMs is exceeded", async () => {
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_test";
    process.env.GITHUB_OWNER = "iurii-izman";
    process.env.GITHUB_REPO = "AIPipeline";

    const client = new GitHubClient({
      fetcher: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true }
          );
        }),
      defaultTimeoutMs: 5,
    });

    await expect(client.getRepository()).rejects.toMatchObject({ code: "NETWORK", retryable: true });
  });

  it("fails fast when required github env is missing", async () => {
    delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;

    expect(() => new GitHubClient({ fetcher: async () => makeResponse(200, {}) })).toThrow();
  });
});
