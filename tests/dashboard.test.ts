import { afterEach, describe, expect, it } from "vitest";

const { getDashboardHtml, createDashboardArtifact, triageDashboardIntake } = require("../src/dashboard.js") as {
  getDashboardHtml: (
    options?:
      | string
      | {
          projectKey?: string;
          stateFilter?: string;
          taskLimit?: number;
          inboxLimit?: number;
          activityLimit?: number;
          query?: string;
          actionsEnabled?: boolean;
        }
  ) => Promise<string>;
  createDashboardArtifact: (options?: {
    requestId?: string;
    projectKey?: string;
    type?: string;
    title?: string;
    body?: string;
  }) => Promise<Record<string, unknown>>;
  triageDashboardIntake: (options?: {
    requestId?: string;
    action?: string;
    projectKey?: string;
    notionPageId?: string;
    intakeItemId?: string;
  }) => Promise<Record<string, unknown>>;
};

const originalFetch = globalThis.fetch;
const originalLinearApiKey = process.env.LINEAR_API_KEY;
const originalNotionToken = process.env.NOTION_TOKEN;
const originalProjectsConfig = process.env.PROJECTS_CONFIG;
const originalDefaultProjectKey = process.env.DEFAULT_PROJECT_KEY;
const originalNotionVersion = process.env.NOTION_VERSION;
const originalIdempotencyStoreFile = process.env.IDEMPOTENCY_STORE_FILE;
let idempotencyTestSequence = 0;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv("LINEAR_API_KEY", originalLinearApiKey);
  restoreEnv("NOTION_TOKEN", originalNotionToken);
  restoreEnv("PROJECTS_CONFIG", originalProjectsConfig);
  restoreEnv("DEFAULT_PROJECT_KEY", originalDefaultProjectKey);
  restoreEnv("NOTION_VERSION", originalNotionVersion);
  restoreEnv("IDEMPOTENCY_STORE_FILE", originalIdempotencyStoreFile);
});

describe("dashboard renderer", () => {
  it("renders project summary, tasks, inbox, and quick links", async () => {
    process.env.LINEAR_API_KEY = "linear-test";
    process.env.NOTION_TOKEN = "notion-test";
    process.env.NOTION_VERSION = "2025-09-03";
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [
        {
          key: "aipipeline",
          label: "AIPipeline",
          emoji: "🔧",
          linearProjectId: "lin-proj-1",
          notionInboxDatabaseId: "notion-db-1",
          links: {
            linear: "https://linear.app/example",
            notion: "https://notion.so/example",
            github: "https://github.com/iurii-izman/AIPipeline",
          },
        },
      ],
    });
    process.env.DEFAULT_PROJECT_KEY = "aipipeline";

    const calls: string[] = [];
    globalThis.fetch = (async (url: string | URL) => {
      const value = String(url);
      calls.push(value);
      if (value.includes("api.linear.app/graphql")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              data: {
                issues: {
                  nodes: [
                    {
                      id: "1",
                      identifier: "AIP-42",
                      title: "Add intake callback handling",
                      url: "https://linear.app/issue/AIP-42",
                      updatedAt: "2026-03-02T12:00:00.000Z",
                      state: { name: "In Progress", type: "started" },
                      project: { id: "lin-proj-1", name: "AIPipeline" },
                    },
                    {
                      id: "2",
                      identifier: "AIP-41",
                      title: "Ship dashboard route",
                      url: "https://linear.app/issue/AIP-41",
                      updatedAt: "2026-03-01T12:00:00.000Z",
                      state: { name: "Done", type: "completed" },
                      project: { id: "lin-proj-1", name: "AIPipeline" },
                    },
                  ],
                },
              },
            }),
        };
      }
      if (value.includes("/v1/databases/notion-db-1") && !value.includes("/query")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              id: "notion-db-1",
              data_sources: [{ id: "notion-ds-1" }],
            }),
        };
      }
      if (value.includes("/v1/databases/notion-db-1/query") || value.includes("/v1/data_sources/notion-ds-1/query")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              results: [
                {
                  url: "https://notion.so/inbox-item",
                  properties: {
                    Title: {
                      type: "title",
                      title: [{ plain_text: "Investigate callback idempotency" }],
                    },
                  },
                },
              ],
            }),
        };
      }
      throw new Error(`Unexpected fetch URL: ${value}`);
    }) as typeof fetch;

    const html = await getDashboardHtml("aipipeline");
    expect(html).toContain("AIPipeline Dashboard");
    expect(html).toContain("Projects Overview");
    expect(html).toContain("AIP-42");
    expect(html).toContain("Investigate callback idempotency");
    expect(html).toContain("Recent Activity");
    expect(html).toContain("Completion: 50.0% (1/2)");
    expect(html).toContain("https://github.com/iurii-izman/AIPipeline");
    expect(calls.some((v) => v.includes("api.linear.app/graphql"))).toBe(true);
    expect(
      calls.some((v) => v.includes("/v1/databases/notion-db-1/query") || v.includes("/v1/data_sources/notion-ds-1/query"))
    ).toBe(true);
  });

  it("renders warning when Linear API key is missing", async () => {
    delete process.env.LINEAR_API_KEY;
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [{ key: "no-linear-key", label: "AIPipeline" }],
    });
    process.env.DEFAULT_PROJECT_KEY = "no-linear-key";
    delete process.env.NOTION_TOKEN;

    globalThis.fetch = (async () => {
      throw new Error("fetch should not be called when tokens are missing");
    }) as typeof fetch;

    const html = await getDashboardHtml("no-linear-key");
    expect(html).toContain("Warnings");
    expect(html).toContain("LINEAR_API_KEY is not configured");
  });

  it("supports state filter and custom task limit options", async () => {
    process.env.LINEAR_API_KEY = "linear-test";
    process.env.NOTION_TOKEN = "notion-test";
    process.env.NOTION_VERSION = "2025-09-03";
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [
        {
          key: "aipipeline",
          label: "AIPipeline",
          linearProjectId: "lin-proj-1",
          notionInboxDatabaseId: "notion-db-1",
        },
      ],
    });
    process.env.DEFAULT_PROJECT_KEY = "aipipeline";

    globalThis.fetch = (async (url: string | URL) => {
      const value = String(url);
      if (value.includes("api.linear.app/graphql")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              data: {
                issues: {
                  nodes: [
                    {
                      id: "1",
                      identifier: "AIP-100",
                      title: "Open item",
                      url: "https://linear.app/issue/AIP-100",
                      updatedAt: "2026-03-02T12:00:00.000Z",
                      state: { name: "Todo", type: "backlog" },
                      project: { id: "lin-proj-1", name: "AIPipeline" },
                    },
                    {
                      id: "2",
                      identifier: "AIP-101",
                      title: "Completed item",
                      url: "https://linear.app/issue/AIP-101",
                      updatedAt: "2026-03-01T12:00:00.000Z",
                      state: { name: "Done", type: "completed" },
                      project: { id: "lin-proj-1", name: "AIPipeline" },
                    },
                  ],
                },
              },
            }),
        };
      }
      if (value.includes("/v1/databases/notion-db-1") && !value.includes("/query")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              id: "notion-db-1",
              data_sources: [{ id: "notion-ds-1" }],
            }),
        };
      }
      if (value.includes("/v1/databases/notion-db-1/query") || value.includes("/v1/data_sources/notion-ds-1/query")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ results: [] }),
        };
      }
      throw new Error(`Unexpected fetch URL: ${value}`);
    }) as typeof fetch;

    const html = await getDashboardHtml({
      projectKey: "aipipeline",
      stateFilter: "completed",
      taskLimit: 1,
      inboxLimit: 5,
      activityLimit: 5,
    });
    expect(html).toContain("filter: completed");
    expect(html).toContain("AIP-101");
    expect(html).not.toContain("AIP-100");
  });

  it("renders search results and action controls when enabled", async () => {
    process.env.LINEAR_API_KEY = "linear-test";
    process.env.NOTION_TOKEN = "notion-test";
    process.env.NOTION_VERSION = "2025-09-03";
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [
        {
          key: "aipipeline",
          label: "AIPipeline",
          linearProjectId: "lin-proj-1",
          notionInboxDatabaseId: "notion-db-1",
          notionSpecsDatabaseId: "notion-specs-1",
        },
      ],
    });
    process.env.DEFAULT_PROJECT_KEY = "aipipeline";

    globalThis.fetch = (async (url: string | URL) => {
      const value = String(url);
      if (value.includes("api.linear.app/graphql")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              data: {
                issues: {
                  nodes: [
                    {
                      id: "1",
                      identifier: "AIP-102",
                      title: "Searchable intake task",
                      url: "https://linear.app/issue/AIP-102",
                      updatedAt: "2026-03-02T12:00:00.000Z",
                      state: { name: "In Progress", type: "started" },
                      project: { id: "lin-proj-1", name: "AIPipeline" },
                    },
                  ],
                },
              },
            }),
        };
      }
      if (value.includes("/v1/databases/notion-db-1") && !value.includes("/query")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              id: "notion-db-1",
              data_sources: [{ id: "notion-ds-1" }],
            }),
        };
      }
      if (value.includes("/v1/databases/notion-specs-1") && !value.includes("/query")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              id: "notion-specs-1",
              data_sources: [{ id: "notion-ds-specs-1" }],
            }),
        };
      }
      if (value.includes("/v1/databases/notion-db-1/query") || value.includes("/v1/data_sources/notion-ds-1/query")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              results: [
                {
                  id: "page-1",
                  url: "https://notion.so/inbox-item",
                  properties: {
                    Name: {
                      type: "title",
                      title: [{ plain_text: "Searchable inbox entry" }],
                    },
                  },
                },
              ],
            }),
        };
      }
      if (value.includes("/v1/databases/notion-specs-1/query") || value.includes("/v1/data_sources/notion-ds-specs-1/query")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              results: [
                {
                  id: "spec-1",
                  url: "https://notion.so/spec-item",
                  properties: {
                    Name: {
                      type: "title",
                      title: [{ plain_text: "Searchable spec entry" }],
                    },
                  },
                },
              ],
            }),
        };
      }
      throw new Error(`Unexpected fetch URL: ${value}`);
    }) as typeof fetch;

    const html = await getDashboardHtml({
      projectKey: "aipipeline",
      query: "searchable",
      actionsEnabled: true,
      taskLimit: 5,
      inboxLimit: 5,
      activityLimit: 5,
    });
    expect(html).toContain("Search Results");
    expect(html).toContain("Searchable intake task");
    expect(html).toContain("Searchable inbox entry");
    expect(html).toContain("Quick Create");
    expect(html).toContain("/dashboard/triage");
  });

  it("renders multi-project tabs and supports selecting secondary project", async () => {
    process.env.LINEAR_API_KEY = "linear-test";
    process.env.NOTION_TOKEN = "notion-test";
    process.env.NOTION_VERSION = "2025-09-03";
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [
        {
          key: "aipipeline",
          label: "AIPipeline",
          emoji: "🔧",
          linearProjectId: "lin-proj-1",
          linearTeamId: "lin-team-1",
          notionInboxDatabaseId: "notion-db-1",
          notionSpecsDatabaseId: "notion-specs-1",
          notionSpecTemplateId: "__NONE__",
          telegramThreadId: "6",
          links: { linear: "https://linear.app/aipipeline", notion: "https://notion.so/aip", github: "https://github.com/iurii-izman/AIPipeline" },
        },
        {
          key: "sandbox",
          label: "Sandbox",
          emoji: "🧪",
          linearProjectId: "lin-proj-2",
          linearTeamId: "lin-team-1",
          notionInboxDatabaseId: "notion-db-2",
          notionSpecsDatabaseId: "notion-specs-2",
          notionSpecTemplateId: "__NONE__",
          telegramThreadId: "7",
          links: { linear: "https://linear.app/sandbox", notion: "https://notion.so/sandbox", github: "https://github.com/iurii-izman/AIPipeline" },
        },
      ],
    });
    process.env.DEFAULT_PROJECT_KEY = "aipipeline";

    globalThis.fetch = (async (url: string | URL) => {
      const value = String(url);
      if (value.includes("api.linear.app/graphql")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              data: {
                issues: {
                  nodes: [
                    {
                      id: "s1",
                      identifier: "SBX-1",
                      title: "Sandbox task",
                      url: "https://linear.app/issue/SBX-1",
                      updatedAt: "2026-03-02T12:00:00.000Z",
                      state: { name: "Todo", type: "backlog" },
                      project: { id: "lin-proj-2", name: "Sandbox" },
                    },
                  ],
                },
              },
            }),
        };
      }
      if (value.includes("/v1/databases/notion-db-1") && !value.includes("/query")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: "notion-db-1", data_sources: [{ id: "notion-ds-1" }] }) };
      }
      if (value.includes("/v1/databases/notion-specs-1") && !value.includes("/query")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: "notion-specs-1", data_sources: [{ id: "notion-ds-specs-1" }] }) };
      }
      if (value.includes("/v1/databases/notion-db-2") && !value.includes("/query")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: "notion-db-2", data_sources: [{ id: "notion-ds-2" }] }) };
      }
      if (value.includes("/v1/databases/notion-specs-2") && !value.includes("/query")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: "notion-specs-2", data_sources: [{ id: "notion-ds-specs-2" }] }) };
      }
      if (
        value.includes("/v1/data_sources/notion-ds-1/query") ||
        value.includes("/v1/data_sources/notion-ds-specs-1/query") ||
        value.includes("/v1/data_sources/notion-ds-2/query") ||
        value.includes("/v1/data_sources/notion-ds-specs-2/query")
      ) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }) };
      }
      throw new Error(`Unexpected fetch URL: ${value}`);
    }) as typeof fetch;

    const html = await getDashboardHtml({ projectKey: "sandbox", taskLimit: 5, inboxLimit: 5, activityLimit: 5 });
    expect(html).toContain("🔧 AIPipeline");
    expect(html).toContain("🧪 Sandbox");
    expect(html).toContain('href="/dashboard?project=sandbox');
    expect(html).toContain("SBX-1");
  });

  it("applies idempotency for create and triage actions", async () => {
    process.env.LINEAR_API_KEY = "linear-test";
    process.env.NOTION_TOKEN = "notion-test";
    process.env.NOTION_VERSION = "2025-09-03";
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [
        {
          key: "aipipeline",
          label: "AIPipeline",
          linearTeamId: "team-1",
          linearProjectId: "proj-1",
          notionInboxDatabaseId: "inbox-db-1",
          notionSpecsDatabaseId: "specs-db-1",
        },
      ],
    });
    process.env.DEFAULT_PROJECT_KEY = "aipipeline";
    idempotencyTestSequence += 1;
    process.env.IDEMPOTENCY_STORE_FILE = `.out/tests/idempotency-${Date.now()}-${idempotencyTestSequence}.jsonl`;

    let linearIssueCreateCalls = 0;
    let notionPatchCalls = 0;
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      const value = String(url);
      if (value.includes("api.linear.app/graphql")) {
        const body = typeof init?.body === "string" ? init.body : "";
        if (body.includes("issueCreate")) {
          linearIssueCreateCalls += 1;
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                data: { issueCreate: { issue: { id: "lin-1", identifier: "AIP-900", url: "https://linear.app/issue/AIP-900", title: "Demo" } } },
              }),
          };
        }
        return { ok: true, status: 200, text: async () => JSON.stringify({ data: { issues: { nodes: [] } } }) };
      }
      if (value.includes("/v1/pages/page-1")) {
        notionPatchCalls += 1;
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: "page-1" }) };
      }
      if (value.includes("/v1/pages")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: "spec-1", url: "https://notion.so/spec-1" }) };
      }
      if (value.includes("/v1/data_sources/") || value.includes("/v1/databases/")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ results: [] }) };
      }
      throw new Error(`Unexpected fetch URL: ${value}`);
    }) as typeof fetch;

    const create1 = await createDashboardArtifact({
      requestId: "create-dup-1",
      projectKey: "aipipeline",
      type: "task",
      title: "Idempotent create",
      body: "payload",
    });
    const create2 = await createDashboardArtifact({
      requestId: "create-dup-1",
      projectKey: "aipipeline",
      type: "task",
      title: "Idempotent create",
      body: "payload",
    });
    expect(create1.ok).toBe(true);
    expect(create2.ok).toBe(true);
    expect(create2.idempotentReplay).toBe(true);
    expect(linearIssueCreateCalls).toBe(1);

    const triage1 = await triageDashboardIntake({
      requestId: "triage-dup-1",
      action: "idea",
      projectKey: "aipipeline",
      notionPageId: "page-1",
    });
    const triage2 = await triageDashboardIntake({
      requestId: "triage-dup-1",
      action: "idea",
      projectKey: "aipipeline",
      notionPageId: "page-1",
    });
    expect(triage1.ok).toBe(true);
    expect(triage2.ok).toBe(true);
    expect(triage2.idempotentReplay).toBe(true);
    expect(notionPatchCalls).toBe(1);
  });
});
