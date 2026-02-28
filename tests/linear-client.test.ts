import { describe, expect, it } from "vitest";
import { LinearClient, LinearError } from "../src/modules/linear-client";

function makeResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LinearClient", () => {
  it("findIssue returns issue on happy path", async () => {
    process.env.LINEAR_API_KEY = "lin_key";
    process.env.LINEAR_TEAM_ID = "team_id";

    const client = new LinearClient({
      fetcher: async () =>
        makeResponse(200, {
          data: { issues: { nodes: [{ id: "1", identifier: "AIP-1", title: "Test" }] } },
        }),
    });

    const issue = await client.findIssue("AIP-1");
    expect(issue?.identifier).toBe("AIP-1");
  });

  it("findIssue returns null when no nodes", async () => {
    process.env.LINEAR_API_KEY = "lin_key";
    process.env.LINEAR_TEAM_ID = "team_id";

    const client = new LinearClient({
      fetcher: async () => makeResponse(200, { data: { issues: { nodes: [] } } }),
    });

    const issue = await client.findIssue("AIP-404");
    expect(issue).toBeNull();
  });

  it("retries on 429 and then succeeds", async () => {
    process.env.LINEAR_API_KEY = "lin_key";
    process.env.LINEAR_TEAM_ID = "team_id";

    let calls = 0;
    const client = new LinearClient({
      fetcher: async () => {
        calls += 1;
        if (calls === 1) return makeResponse(429, { errors: [{ message: "rate limited" }] });
        return makeResponse(200, { data: { issues: { nodes: [] } } });
      },
    });

    const issues = await client.listIssues(5);
    expect(issues).toEqual([]);
    expect(calls).toBe(2);
  });

  it("opens circuit breaker after repeated upstream failures", async () => {
    process.env.LINEAR_API_KEY = "lin_key";
    process.env.LINEAR_TEAM_ID = "team_id";

    const client = new LinearClient({
      fetcher: async () => makeResponse(400, { errors: [{ message: "bad request" }] }),
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(client.listIssues()).rejects.toBeInstanceOf(LinearError);
    }

    await expect(client.listIssues()).rejects.toMatchObject({ code: "CIRCUIT_OPEN" });
  });

  it("throws typed error on invalid response", async () => {
    process.env.LINEAR_API_KEY = "lin_key";
    process.env.LINEAR_TEAM_ID = "team_id";

    const client = new LinearClient({
      fetcher: async () => makeResponse(200, { data: null }),
    });

    await expect(client.listIssues()).rejects.toBeInstanceOf(LinearError);
  });

  it("throws typed error on non-retryable graphql error", async () => {
    process.env.LINEAR_API_KEY = "lin_key";
    process.env.LINEAR_TEAM_ID = "team_id";

    const client = new LinearClient({
      fetcher: async () => makeResponse(200, { errors: [{ message: "invalid query" }] }),
    });

    await expect(client.listIssues()).rejects.toMatchObject({ code: "BAD_RESPONSE", retryable: false });
  });

  it("throws typed network error", async () => {
    process.env.LINEAR_API_KEY = "lin_key";
    process.env.LINEAR_TEAM_ID = "team_id";

    const client = new LinearClient({
      fetcher: async () => {
        throw new Error("network timeout");
      },
    });

    await expect(client.listIssues()).rejects.toBeInstanceOf(LinearError);
  });

  it("throws when updateIssueState returns success=false", async () => {
    process.env.LINEAR_API_KEY = "lin_key";
    process.env.LINEAR_TEAM_ID = "team_id";

    const client = new LinearClient({
      fetcher: async () => makeResponse(200, { data: { issueUpdate: { success: false, issue: null } } }),
    });

    await expect(client.updateIssueState("issue-id", "state-id")).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("throws when createIssue returns success=false", async () => {
    process.env.LINEAR_API_KEY = "lin_key";
    process.env.LINEAR_TEAM_ID = "team_id";

    const client = new LinearClient({
      fetcher: async () => makeResponse(200, { data: { issueCreate: { success: false, issue: null } } }),
    });

    await expect(client.createIssue({ teamId: "team_id", title: "hello" })).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("fails fast when required linear env is missing", async () => {
    delete process.env.LINEAR_API_KEY;
    delete process.env.LINEAR_TEAM_ID;

    expect(() => new LinearClient({ fetcher: async () => makeResponse(200, { data: {} }) })).toThrow();
  });
});
