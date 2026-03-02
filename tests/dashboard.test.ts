import { afterEach, describe, expect, it } from "vitest";

const { getDashboardHtml } = require("../src/dashboard.js") as {
  getDashboardHtml: (projectKey?: string) => Promise<string>;
};

const originalFetch = global.fetch;
const originalLinearApiKey = process.env.LINEAR_API_KEY;
const originalNotionToken = process.env.NOTION_TOKEN;
const originalProjectsConfig = process.env.PROJECTS_CONFIG;
const originalDefaultProjectKey = process.env.DEFAULT_PROJECT_KEY;
const originalNotionVersion = process.env.NOTION_VERSION;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

afterEach(() => {
  global.fetch = originalFetch;
  restoreEnv("LINEAR_API_KEY", originalLinearApiKey);
  restoreEnv("NOTION_TOKEN", originalNotionToken);
  restoreEnv("PROJECTS_CONFIG", originalProjectsConfig);
  restoreEnv("DEFAULT_PROJECT_KEY", originalDefaultProjectKey);
  restoreEnv("NOTION_VERSION", originalNotionVersion);
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
    global.fetch = (async (url: string | URL) => {
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
      if (value.includes("/v1/databases/notion-db-1/query")) {
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
    expect(html).toContain("AIP-42");
    expect(html).toContain("Investigate callback idempotency");
    expect(html).toContain("Completion: 50.0% (1/2)");
    expect(html).toContain("https://github.com/iurii-izman/AIPipeline");
    expect(calls.some((v) => v.includes("api.linear.app/graphql"))).toBe(true);
    expect(calls.some((v) => v.includes("/v1/databases/notion-db-1/query"))).toBe(true);
  });

  it("renders warning when Linear API key is missing", async () => {
    delete process.env.LINEAR_API_KEY;
    process.env.PROJECTS_CONFIG = JSON.stringify({
      projects: [{ key: "no-linear-key", label: "AIPipeline" }],
    });
    process.env.DEFAULT_PROJECT_KEY = "no-linear-key";
    delete process.env.NOTION_TOKEN;

    global.fetch = (async () => {
      throw new Error("fetch should not be called when tokens are missing");
    }) as typeof fetch;

    const html = await getDashboardHtml("no-linear-key");
    expect(html).toContain("Warnings");
    expect(html).toContain("LINEAR_API_KEY is not configured");
  });
});
